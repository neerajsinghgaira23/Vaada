"""
backend/app/voice_agent/agent.py — Voice Agent Brain for Vaada dashboard.
Orchestrates Sarvam AI (STT/TTS/LLM) + Cashfree Payment Links with human confirmation.
"""
from __future__ import annotations

import logging
import re
import time
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from .accounts import describe, find_merchant
from .sarvam import LANGUAGE_NAMES, SarvamClient, SarvamError
from .settings import VoiceSettings
from ..cashfree import create_cashfree_link
from ..database import scoped_query
from ..models import Customer, Invoice, PaymentLinkDispatch, Event
from ..clock import get_today

logger = logging.getLogger("voice_agent")

SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TTL = 3600  # 1 hour


def get_voice_session(session_id: str) -> Dict[str, Any]:
    now = time.time()
    # Expire old sessions
    for k in list(SESSIONS.keys()):
        if now - SESSIONS[k].get("touched", now) > SESSION_TTL:
            SESSIONS.pop(k, None)
    if session_id not in SESSIONS:
        SESSIONS[session_id] = {"pending": None, "history": [], "touched": now}
    SESSIONS[session_id]["touched"] = now
    return SESSIONS[session_id]


def _amount(text: str) -> Optional[float]:
    # Extract numbers like 2500, 2,500, 500
    match = re.search(r"(\d[\d,]*\.?\d*)", text or "")
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            pass
    # Indian word numbers
    low = (text or "").lower()
    if "dhai hazaar" in low or "dhai hazar" in low:
        return 2500.0
    if "dedh hazaar" in low or "dedh hazar" in low:
        return 1500.0
    if "paanch sau" in low:
        return 500.0
    if "das hazaar" in low or "das hazar" in low:
        return 10000.0
    if "ek lakh" in low:
        return 100000.0
    return None


def rule_plan(text: str, pending: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Robust keyword & pattern fallback when LLM is unavailable or offline."""
    lowered = (text or "").lower()
    plan: Dict[str, Any] = {
        "intent": "unknown",
        "account": None,
        "amount": None,
        "note": None,
        "reply": "",
    }

    says_yes = any(
        w in lowered
        for w in (
            "yes", "yeah", "yep", "haan", "han ", "ha ", "theek", "okay", "ok",
            "confirm", "kar do", "karo", "sahi", "sure", "bhejo", "bhej do",
        )
    )
    says_no = any(
        w in lowered for w in ("no ", "nahi", "nahin", "cancel", "stop", "mat ", "don't")
    )

    if pending and says_yes:
        plan["intent"] = "confirm"
        return plan
    if says_no:
        plan["intent"] = "cancel"
        return plan

    if any(w in lowered for w in ("kaun kaun", "list", "customers", "accounts", "pending list")):
        plan["intent"] = "list"
        return plan

    if any(w in lowered for w in ("kitna baaki", "kitna balance", "pending amount", "due amount", "how much")):
        plan["intent"] = "balance"
        return plan

    if any(w in lowered for w in ("request", "collect", "link", "bana do", "bhejo", "bhej do", "maango")):
        plan["intent"] = "collect"
    elif any(w in lowered for w in ("payout", "transfer", "pay")):
        plan["intent"] = "payout"
    elif any(w in lowered for w in ("help", "kya kar sakte ho", "what can you do")):
        plan["intent"] = "help"
    else:
        return plan

    plan["amount"] = _amount(text)
    return plan


class VoiceAgent:
    def __init__(self, settings: Optional[VoiceSettings] = None) -> None:
        self.s = settings or VoiceSettings()
        self.sarvam = SarvamClient(self.s)

    async def get_merchants(self, business_id: int, db: AsyncSession) -> list[dict]:
        """Fetch real customers from Vaada database for the current business."""
        c_res = await db.execute(scoped_query(Customer, business_id))
        customers = c_res.scalars().all()
        merchants = []
        for c in customers:
            # Get pending balance & main invoice
            inv_res = await db.execute(
                scoped_query(Invoice, business_id).where(
                    and_(Invoice.customer_id == c.id, Invoice.status.in_(["unpaid", "partial"]))
                )
            )
            invoices = inv_res.scalars().all()
            rem = sum(inv.total - inv.amount_paid for inv in invoices)
            main_inv = invoices[0] if invoices else None
            merchants.append({
                "id": c.id,
                "name": c.name,
                "aliases": [c.name.lower(), c.name.split()[0].lower()],
                "phone": c.phone,
                "email": c.email or f"{c.name.lower().replace(' ', '')}@example.com",
                "outstanding": float(rem),
                "invoice_id": main_inv.id if main_inv else None,
                "invoice_number": main_inv.number if main_inv else None,
            })
        return merchants

    async def handle_turn(
        self,
        session_id: str,
        text: str,
        language_code: str = "hi-IN",
        business_id: int = 1,
        db: Optional[AsyncSession] = None,
    ) -> Dict[str, Any]:
        text = (text or "").strip()
        state = get_voice_session(session_id)
        merchants = await self.get_merchants(business_id, db) if db else []

        if not text:
            return {
                "transcript": "",
                "reply": "Main sun nahi paaya, kripya dobara bolein.",
                "language_code": language_code,
                "action": None,
                "audio": "",
            }

        language_name = LANGUAGE_NAMES.get(language_code, "Hindi")
        plan, used_llm = await self._plan(text, state, language_name, merchants)

        action = None
        reply = plan.get("reply") or ""

        # Intent handling
        if plan["intent"] == "confirm" and state.get("pending"):
            action, reply = await self._execute(state["pending"], business_id, db, language_code, language_name)
            state["pending"] = None

        elif plan["intent"] == "cancel":
            had_pending = bool(state.get("pending"))
            state["pending"] = None
            reply = (
                "Radd kar diya gaya. Koi payment link nahi bheja gaya."
                if had_pending
                else "Koi pending payment request nahi thi."
            )

        elif plan["intent"] == "list":
            names = ", ".join(m["name"] for m in merchants[:5])
            reply = f"Aapke paas {len(merchants)} customers hain: {names}."

        elif plan["intent"] == "balance":
            query = plan.get("account") or text
            merchant, _ = find_merchant(query, merchants)
            if merchant:
                reply = f"{merchant['name']} ka kul ₹{merchant['outstanding']:.0f} pending hai."
            else:
                reply = "Kripya customer ka naam batayein jinka balance jaanna hai."

        elif plan["intent"] in ("collect", "payout"):
            prepared, reply = self._prepare(plan, text, merchants, language_code, language_name)
            if prepared is not None:
                state["pending"] = prepared
                action = {
                    "type": "pending",
                    "status": "awaiting_confirmation",
                    "merchant": prepared["merchant"]["name"],
                    "amount": prepared["amount"],
                    "direction": prepared["intent"],
                }
            else:
                state["pending"] = None

        elif plan["intent"] == "help":
            reply = (
                "Main Vaada ka Voice Agent hoon. Aap bol sakte hain: "
                "'Rahul Enterprises se 2500 ka payment link banao', ya 'Kaun se customers pending hain?'"
            )
        else:
            # Default helpful prompt
            query = plan.get("account") or text
            merchant, _ = find_merchant(query, merchants)
            if merchant:
                reply = f"{merchant['name']} ka ₹{merchant['outstanding']:.0f} baaki hai. Kya inka payment link banana hai?"
            else:
                reply = "Aap kis customer ka payment link banana chahte hain aur kitne rupaye ka?"

        state["history"].append({"user": text, "assistant": reply})

        # Generate audio using Sarvam TTS
        audio = ""
        try:
            audio = await self.sarvam.speak(reply, language_code)
        except Exception as exc:
            logger.warning("TTS generation skipped: %s", exc)

        return {
            "transcript": text,
            "reply": reply,
            "language_code": language_code,
            "action": action,
            "audio": audio,
            "planner": "llm" if used_llm else "rules",
        }

    async def _plan(
        self, text: str, state: dict, language_name: str, merchants: list[dict]
    ) -> Tuple[dict, bool]:
        """Try Sarvam LLM, fall back cleanly to rule parser."""
        try:
            accounts_desc = "\n".join(f"- {describe(m)}" for m in merchants) or "- (none)"
            sys_prompt = f"""You are the voice assistant for an Indian business owner on Vaada.
You create Cashfree payment links for customers based on spoken voice commands in {language_name}.
Never use markdown, emojis or URLs in 'reply'. Keep replies in 1 or 2 spoken sentences in {language_name}.
Return ONLY JSON:
{{
  "intent": "collect" | "confirm" | "cancel" | "list" | "balance" | "help" | "unknown",
  "account": string | null,
  "amount": number | null,
  "reply": string
}}
Available customers:
{accounts_desc}"""
            pending_desc = f"Pending action: {state['pending']}" if state.get("pending") else "No pending action."
            res = await self.sarvam.chat_json(
                sys_prompt, f"Context: {pending_desc}\nUser command: {text}"
            )
            if res.get("intent") and res["intent"] != "unknown":
                return res, True
        except Exception as exc:
            logger.info("Sarvam LLM fallback to rules: %s", exc)

        plan = rule_plan(text, state.get("pending"))
        return plan, False

    def _prepare(
        self, plan: dict, text: str, merchants: list[dict], language_code: str, language_name: str
    ) -> Tuple[Optional[dict], str]:
        query = plan.get("account") or text
        merchant, score = find_merchant(query, merchants)
        amount = plan.get("amount") or _amount(text)

        if merchant is None:
            avail = ", ".join(m["name"] for m in merchants[:4])
            return None, f"Customer nahi mila. Hamare paas {avail} uplabdh hain."

        if amount is None:
            # Use outstanding as default
            amount = merchant.get("outstanding") or 1000.0

        if amount < 1:
            return None, "Rakam kam se kam 1 rupaya honi chahiye."

        if amount > self.s.max_amount:
            return None, f"Yeh hamari ₹{self.s.max_amount:.0f} ki seema se zyada hai."

        reply = f"{merchant['name']} ke liye ₹{amount:.0f} ka Cashfree payment link banayein? Kripya 'Haan' ya 'Cancel' bolein."
        return {
            "intent": "collect",
            "merchant": merchant,
            "amount": amount,
        }, reply

    async def _execute(
        self, pending: dict, business_id: int, db: AsyncSession, language_code: str, language_name: str
    ) -> Tuple[dict, str]:
        merchant = pending["merchant"]
        amount = Decimal(str(pending["amount"]))
        invoice_id = merchant.get("invoice_id")

        # Create Cashfree Payment Link
        ts = int(time.time() * 1000)
        link_id = f"voice_{merchant['id']}_{ts}"

        cf_res = await create_cashfree_link(
            link_id=link_id,
            amount=amount,
            purpose=f"Voice Pay Request for {merchant['name']}",
            customer_name=merchant["name"],
            customer_phone=merchant.get("phone", "9876543210"),
            customer_email=merchant.get("email"),
            notes={"business_id": str(business_id), "source": "voice_agent"},
        )

        link_url = cf_res.get("link_url", f"https://sandbox.cashfree.com/pg/links/{link_id}")
        qr_code = cf_res.get("qr_code")

        # Record in Vaada DB
        if db and invoice_id:
            dispatch = PaymentLinkDispatch(
                business_id=business_id,
                invoice_id=invoice_id,
                cashfree_link_id=cf_res.get("cf_link_id", link_id),
                link_url=link_url,
                qr_code=qr_code,
                amount=amount,
                channel="voice_agent",
                message=f"Voice-created payment link for ₹{amount}",
                status="draft",
            )
            db.add(dispatch)

            today = await get_today(db)
            now_dt = datetime.combine(today, datetime.min.time())
            db.add(Event(
                business_id=business_id,
                time=now_dt,
                actor="AI",
                action="voice_payment_link_created",
                details={
                    "customer": merchant["name"],
                    "amount": float(amount),
                    "link_url": link_url,
                },
            ))
            await db.commit()

        action = {
            "type": "collect",
            "status": "link_created",
            "merchant": merchant["name"],
            "amount": float(amount),
            "invoice_id": invoice_id,
            "link_url": link_url,
            "reference": link_id,
        }
        reply = f"Badhai ho! {merchant['name']} ke liye ₹{amount:.0f} ka Cashfree payment link ban gaya hai."
        return action, reply
