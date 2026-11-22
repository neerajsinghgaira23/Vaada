"""
backend/app/voice_agent/agent.py — Multilingual AI Voice Agent for Vaada.
Understands ANY natural voice or text query in English, Hindi, Kannada, Tamil, etc.,
and replies in the EXACT language requested using Sarvam AI & Cashfree with live real-time business data.
"""
from __future__ import annotations

import logging
import re
import time
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import select, and_, func, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from .accounts import describe, find_merchant, KNOWN_TRANSLATIONS
from .sarvam import LANGUAGE_NAMES, SarvamClient, SarvamError
from .settings import VoiceSettings
from ..cashfree import create_cashfree_link
from ..database import scoped_query
from ..models import Customer, Invoice, PaymentLinkDispatch, Event, Promise, Business
from ..clock import get_today

logger = logging.getLogger("voice_agent")

SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TTL = 3600  # 1 hour


def get_voice_session(session_id: str) -> Dict[str, Any]:
    now = time.time()
    for k in list(SESSIONS.keys()):
        if now - SESSIONS[k].get("touched", now) > SESSION_TTL:
            SESSIONS.pop(k, None)
    if session_id not in SESSIONS:
        SESSIONS[session_id] = {"pending": None, "history": [], "touched": now}
    SESSIONS[session_id]["touched"] = now
    return SESSIONS[session_id]


def detect_language(text_str: str, default_code: str = "hi-IN") -> tuple[str, str]:
    """
    Detects language from user's spoken or written text.
    Returns (language_code, language_name), e.g. ('en-IN', 'English') or ('hi-IN', 'Hindi').
    """
    s = (text_str or "").strip()
    if not s:
        return default_code, LANGUAGE_NAMES.get(default_code, "Hindi")

    # Script based detection
    if re.search(r"[\u0900-\u097F]", s):
        return "hi-IN", "Hindi"
    if re.search(r"[\u0C80-\u0CFF]", s):
        return "kn-IN", "Kannada"
    if re.search(r"[\u0B80-\u0BFF]", s):
        return "ta-IN", "Tamil"
    if re.search(r"[\u0C00-\u0C7F]", s):
        return "te-IN", "Telugu"
    if re.search(r"[\u0980-\u09FF]", s):
        return "bn-IN", "Bengali"

    # Latin script: English vs Hinglish
    low = s.lower()
    english_words = {
        "what", "is", "the", "balance", "of", "customer", "customers", "show", "me",
        "create", "link", "payment", "for", "who", "whom", "should", "i", "call", "first",
        "give", "details", "detail", "how", "much", "due", "pending", "overdue", "summary",
        "shop", "financial", "advice", "remind", "reminder", "send", "generate", "please",
        "yes", "confirm", "proceed", "cancel", "stop", "check", "tell", "account", "invoices",
        "invoice", "total", "collected", "paid", "unpaid", "phone", "number", "email", "history",
        "hi", "hello", "good", "morning", "afternoon", "evening"
    }
    hinglish_words = {
        "ka", "ki", "ke", "ko", "se", "hai", "hain", "karo", "kar", "do", "kripya", "batao",
        "bataiye", "bhejo", "bhej", "kiska", "kisko", "pehle", "chahiye", "kitna", "kitni",
        "baaki", "bana", "rakam", "hisaab", "hisab", "rupaye", "paisa", "paise", "naam", "sabke",
        "haan", "han", "nahi", "nahin", "theek", "radd", "dhai", "dedh", "hazaar", "sau"
    }
    words = re.findall(r"[a-z]+", low)
    en_count = sum(1 for w in words if w in english_words)
    hi_count = sum(1 for w in words if w in hinglish_words)

    if en_count > hi_count:
        return "en-IN", "English"
    if hi_count > en_count:
        return "hi-IN", "Hindi"
    return default_code, LANGUAGE_NAMES.get(default_code, "Hindi")


def _amount(text_str: str) -> Optional[float]:
    match = re.search(r"(\d[\d,]*\.?\d*)", text_str or "")
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            pass
    low = (text_str or "").lower()
    if "dhai hazaar" in low or "dhai hazar" in low or "ढाई हज़ार" in low or "ढाई हजार" in low:
        return 2500.0
    if "dedh hazaar" in low or "dedh hazar" in low or "डेढ़ हज़ार" in low or "डेढ़ हजार" in low:
        return 1500.0
    if "paanch sau" in low or "पांच सौ" in low or "पाँच सौ" in low:
        return 500.0
    if "das hazaar" in low or "das hazar" in low or "दस हज़ार" in low or "दस हजार" in low:
        return 10000.0
    if "ek lakh" in low or "एक लाख" in low:
        return 100000.0
    return None


def rule_plan(text_str: str, pending: Optional[Dict[str, Any]], context: Dict[str, Any]) -> Dict[str, Any]:
    """Smart fallback understanding ANY query in Hindi, Hinglish or English."""
    lowered = (text_str or "").lower()
    plan: Dict[str, Any] = {
        "intent": "general",
        "account": None,
        "amount": _amount(text_str),
        "note": None,
        "reply": "",
    }

    says_yes = any(
        w in lowered
        for w in (
            "yes", "yeah", "yep", "haan", "han ", "ha ", "theek", "okay", "ok",
            "confirm", "kar do", "karo", "sahi", "sure", "bhejo", "bhej do",
            "हाँ", "हां", "ठीक है", "भेज दो", "कर दो", "बना दो",
        )
    )
    says_no = any(
        w in lowered for w in ("no ", "nahi", "nahin", "cancel", "stop", "mat ", "don't", "नहीं", "रद्द", "मत")
    )

    if pending and says_yes:
        plan["intent"] = "confirm"
        return plan
    if says_no:
        plan["intent"] = "cancel"
        return plan

    # 1. Advice & Priority Queue
    if any(w in lowered for w in (
        "pehle", "priority", "kis se pehle", "kisko call", "first", "advice", "chase",
        "who should", "whom should", "call first",
        "सलाह", "पहले", "किसे कॉल", "कॉल करूं", "किसको फोन"
    )):
        plan["intent"] = "advice"
        return plan

    # 2. Financial Summary
    if any(w in lowered for w in (
        "hisaab", "hisab", "summary", "total", "collection", "kpi", "overdue kitna", "outstanding",
        "financial summary", "shop summary", "how much collected",
        "हिसाब", "हिशाब", "कुल", "बकाया", "कलेक्शन", "समरी", "दुकान का हिसाब"
    )):
        plan["intent"] = "summary"
        return plan

    # 3. Draft Reminder message
    if any(w in lowered for w in (
        "reminder", "message", "sms", "whatsapp", "draft", "remind",
        "रिमाइंडर", "मैसेज", "संदेश", "याद दिलाओ", "ताकीद"
    )):
        plan["intent"] = "reminder"
        return plan

    # 4. Promises inquiry
    if any(w in lowered for w in (
        "vaada", "vada", "promise", "promises", "mukra", "broken",
        "वादा", "प्रॉमिस", "मुकरा", "कसम"
    )):
        plan["intent"] = "promises"
        return plan

    # 5. List customers
    if any(w in lowered for w in (
        "kaun kaun", "list", "customers", "accounts", "pending list", "sabke naam",
        "list customers", "show customers", "all customers",
        "लिस्ट", "ग्राहक", "कस्टमर लिस्ट", "नाम बताओ", "सबके नाम"
    )):
        plan["intent"] = "list"
        return plan

    # 6. Specific Customer balance & details
    if any(w in lowered for w in (
        "kitna baaki", "kitna balance", "pending amount", "due amount", "how much", "balance",
        "balance of", "pending of", "details of", "detail", "details", "phone", "invoice",
        "बैलेंस", "बकाया", "कितना बाकी", "कितने पैसे", "रुपये बाकी", "का हिसाब",
        "डिटेल", "फोन", "नंबर", "बिल", "जानकारी"
    )):
        plan["intent"] = "balance"
        return plan

    # 7. Collect / Payment Link
    if any(w in lowered for w in (
        "link", "request", "collect", "bana do", "maango", "paise mangwa", "payment link",
        "create link", "payment link for", "collect from",
        "लिंक", "पेमेंट लिंक", "मांगो", "पैसे मांग"
    )):
        plan["intent"] = "collect"
        return plan

    # 8. Greetings / Small talk
    if any(w in lowered for w in (
        "namaste", "hello", "hi ", "kaise ho", "kya haal", "good morning", "good evening",
        "नमस्ते", "प्रणाम", "हेलो", "सुप्रभात"
    )):
        plan["intent"] = "greeting"
        return plan

    return plan


class VoiceAgent:
    def __init__(self, settings: Optional[VoiceSettings] = None) -> None:
        self.s = settings or VoiceSettings()
        self.sarvam = SarvamClient(self.s)

    async def get_merchants(self, business_id: int, db: Optional[AsyncSession] = None) -> list[dict]:
        ctx = await self.get_business_context(business_id, db)
        return ctx.get("merchants", [])

    async def get_business_context(self, business_id: int, db: Optional[AsyncSession] = None) -> Dict[str, Any]:
        """Fetch complete real-time financial context from Vaada database."""
        if db is None:
            from ..database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                return await self.get_business_context(business_id, session)

        today = await get_today(db)

        # 1. Customers & Outstanding
        c_res = await db.execute(scoped_query(Customer, business_id))
        customers = c_res.scalars().all()

        # Fallback if this business_id has no customers (e.g. sequence shifted)
        if not customers:
            first_b_res = await db.execute(select(Business.id).order_by(Business.id.asc()).limit(1))
            fallback_bid = first_b_res.scalar_one_or_none()
            if fallback_bid and fallback_bid != business_id:
                business_id = fallback_bid
                c_res = await db.execute(scoped_query(Customer, business_id))
                customers = c_res.scalars().all()

        merchants = []
        for c in customers:
            inv_res = await db.execute(
                scoped_query(Invoice, business_id).where(
                    and_(Invoice.customer_id == c.id, Invoice.status.in_(["unpaid", "partial"]))
                )
            )
            invoices = inv_res.scalars().all()
            rem = sum(inv.total - inv.amount_paid for inv in invoices)
            overdue_days = max(
                [(today - inv.due_date).days for inv in invoices if inv.due_date < today] or [0]
            )
            main_inv = invoices[0] if invoices else None

            p_res = await db.execute(
                scoped_query(Promise, business_id).where(Promise.customer_id == c.id).order_by(Promise.created_at.desc())
            )
            customer_promises = p_res.scalars().all()
            latest_promise = customer_promises[0] if customer_promises else None
            promise_summary = f"{latest_promise.status} promise of ₹{latest_promise.promised_amount}" if latest_promise else "None"

            aliases = [c.name.lower(), c.name.split()[0].lower()]
            c_low = c.name.lower()
            if c_low in KNOWN_TRANSLATIONS:
                aliases.extend(KNOWN_TRANSLATIONS[c_low])

            merchants.append({
                "id": c.id,
                "name": c.name,
                "aliases": aliases,
                "phone": c.phone,
                "email": c.email or f"{c.name.lower().replace(' ', '')}@example.com",
                "outstanding": float(rem),
                "overdue_days": overdue_days,
                "invoice_id": main_inv.id if main_inv else None,
                "invoice_number": main_inv.number if main_inv else None,
                "promise_status": latest_promise.status if latest_promise else None,
                "promise_summary": promise_summary,
            })

        # 2. KPI metrics
        inv_all_res = await db.execute(
            scoped_query(Invoice, business_id).where(Invoice.status.in_(["unpaid", "partial"]))
        )
        all_unpaid = inv_all_res.scalars().all()
        outstanding = float(sum(inv.total - inv.amount_paid for inv in all_unpaid))
        overdue = float(sum(inv.total - inv.amount_paid for inv in all_unpaid if inv.due_date < today))

        coll_res = await db.execute(
            select(func.sum(Invoice.amount_paid)).where(Invoice.business_id == business_id)
        )
        collected = float(coll_res.scalar_one_or_none() or Decimal("0"))

        # 3. Promises
        prom_res = await db.execute(
            scoped_query(Promise, business_id).order_by(Promise.promised_date.desc())
        )
        promises = prom_res.scalars().all()
        broken = [p for p in promises if p.status == "broken"]
        open_p = [p for p in promises if p.status == "open"]

        return {
            "business_id": business_id,
            "today": today.isoformat(),
            "merchants": merchants,
            "outstanding": outstanding,
            "overdue": overdue,
            "collected": collected,
            "broken_promises_count": len(broken),
            "open_promises_count": len(open_p),
        }

    async def handle_turn(
        self,
        session_id: str,
        text: str = "",
        language_code: str = "hi-IN",
        business_id: int = 1,
        db: Optional[AsyncSession] = None,
    ) -> Dict[str, Any]:
        text_str = (text or "").strip()
        state = get_voice_session(session_id)
        ctx = await self.get_business_context(business_id, db)
        effective_biz_id = ctx.get("business_id", business_id)
        merchants = ctx.get("merchants", [])

        # Auto-detect language so questions in English get answers in English, and Hindi in Hindi
        detected_code, detected_name = detect_language(text_str, language_code)
        is_english = detected_code == "en-IN"

        if not text_str:
            fallback_empty = "I did not catch that, please speak again." if is_english else "Main sun nahi paaya, kripya dobara bolein."
            return {
                "transcript": "",
                "reply": fallback_empty,
                "language_code": detected_code,
                "action": None,
                "audio": "",
            }

        plan, used_llm = await self._plan(text_str, state, detected_name, ctx)

        action = None
        reply = plan.get("reply") or ""

        # If amount is mentioned with a collection / request word, force collect intent
        amt_in_text = _amount(text_str)
        lowered_txt = text_str.lower()
        if amt_in_text and any(w in lowered_txt for w in ("maango", "collect", "link", "bana", "create", "send", "मांग", "लिंक", "लेना", "bhejo")):
            plan["intent"] = "collect"
            if not plan.get("amount"):
                plan["amount"] = amt_in_text

        # If user explicitly cancels or denies, force cancel intent
        if any(w in lowered_txt for w in ("cancel", "nahi", "nahin", "stop", "रद्द", "नहीं")):
            plan["intent"] = "cancel"

        # Intent handling with multilingual support
        if plan["intent"] == "confirm" and state.get("pending"):
            action, reply = await self._execute(state["pending"], effective_biz_id, db, detected_code, detected_name)
            state["pending"] = None

        elif plan["intent"] == "cancel":
            had_pending = bool(state.get("pending"))
            state["pending"] = None
            if is_english:
                reply = "Request cancelled. No payment link was sent." if had_pending else "No pending payment link to cancel."
            else:
                reply = (
                    "Radd kar diya gaya (cancelled). Koi payment link nahi bheja gaya."
                    if had_pending
                    else "Radd kar diya gaya (cancelled). Koi pending payment request nahi thi."
                )

        elif plan["intent"] == "advice":
            broken_names = [m["name"] for m in merchants if m.get("overdue_days", 0) > 7]
            top_rec = merchants[0]["name"] if merchants else "any customer"
            if is_english:
                if broken_names:
                    reply = f"You should prioritize calling {broken_names[0]} first as their invoice is overdue. After that, you can follow up with {top_rec}."
                else:
                    reply = f"You can follow up with {top_rec} first, their payment history is reliable."
            else:
                if broken_names:
                    reply = f"Aapko sabse pehle {broken_names[0]} se baat karni chahiye kyunki inka payment kaafi dino se overdue hai. Uske baad {top_rec} se collection kar sakte hain."
                else:
                    reply = f"Aap sabse pehle {top_rec} ko follow-up kar sakte hain, inka response score achha hai."

        elif plan["intent"] == "summary":
            if is_english:
                reply = (
                    f"Sunil Cloth House financial summary: Total outstanding is ₹{ctx['outstanding']:,.0f}, "
                    f"with ₹{ctx['overdue']:,.0f} overdue. Total collected is ₹{ctx['collected']:,.0f}. "
                    f"There are {ctx.get('open_promises_count', 0)} open promises."
                )
            else:
                reply = (
                    f"Sunil Cloth House ka poora hisaab: Kul outstanding ₹{ctx['outstanding']:,.0f} hai, "
                    f"jisme se ₹{ctx['overdue']:,.0f} overdue hai. Ab tak kul ₹{ctx['collected']:,.0f} collect ho chuka hai. "
                    f"Dukaan mein {ctx.get('open_promises_count', 0)} open promises hain."
                )

        elif plan["intent"] == "reminder":
            query = plan.get("account") or text_str
            merchant, _ = find_merchant(query, merchants)
            target_name = merchant["name"] if merchant else "Customer"
            amt = f"₹{merchant['outstanding']:,.0f}" if merchant else "pending invoice"
            if is_english:
                reply = f"Reminder for {target_name}: 'Dear {target_name}, you have a pending payment of {amt} for Sunil Cloth House. Please clear it today.'"
            else:
                reply = f"{target_name} ke liye reminder: 'Namaste {target_name}, Sunil Cloth House se aapka {amt} baaki hai. Kripya aaj clear karne ka kasht karein.'"

        elif plan["intent"] == "promises":
            if is_english:
                reply = f"You have {ctx.get('open_promises_count', 0)} open promises and {ctx.get('broken_promises_count', 0)} broken promises."
            else:
                reply = f"Aapke system mein {ctx.get('open_promises_count', 0)} open promises hain aur {ctx.get('broken_promises_count', 0)} broken promises hain."

        elif plan["intent"] == "list":
            if is_english:
                names = ", ".join(f"{m['name']} (₹{m['outstanding']:,.0f})" for m in merchants[:5])
                reply = f"Your main customers are: {names}."
            else:
                names = ", ".join(f"{m['name']} (₹{m['outstanding']:,.0f})" for m in merchants[:5])
                reply = f"Aapke mukhya customers: {names}."

        elif plan["intent"] == "balance":
            query = plan.get("account") or text_str
            merchant, _ = find_merchant(query, merchants)
            if merchant:
                inv_str = f"Invoice #{merchant['invoice_number']}" if merchant.get("invoice_number") else "No open invoice"
                if is_english:
                    reply = (
                        f"{merchant['name']} has a pending balance of ₹{merchant['outstanding']:,.0f} "
                        f"({merchant['overdue_days']} days overdue). {inv_str}. Phone: {merchant.get('phone', 'N/A')}."
                    )
                else:
                    reply = (
                        f"{merchant['name']} ka kul ₹{merchant['outstanding']:,.0f} pending hai "
                        f"({merchant['overdue_days']} din overdue). {inv_str}. Phone: {merchant.get('phone', 'N/A')}."
                    )
            else:
                reply = "Please state the customer name whose balance you want to know." if is_english else "Kripya customer ka naam batayein jinka balance ya detail jaanna hai."

        elif plan["intent"] == "greeting":
            if is_english:
                reply = "Hello! I am your Vaada Assistant. I can create Cashfree payment links, give recovery advice, check customer balances, and draft reminders. How can I help?"
            else:
                reply = "Namaste! Main aapka Vaada Assistant hoon. Main payment links bana sakta hoon, summary bata sakta hoon, customer balance de sakta hoon, aur reminders draft kar sakta hoon. Kahiye kya madad karun?"

        elif plan["intent"] in ("collect", "payout") or (plan.get("amount") and any(m["name"].lower() in text_str.lower() for m in merchants)):
            prepared, reply = self._prepare(plan, text_str, merchants, detected_code, detected_name)
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
        else:
            query = plan.get("account") or text_str
            merchant, _ = find_merchant(query, merchants)
            if merchant:
                inv_str = f"Invoice #{merchant['invoice_number']}" if merchant.get("invoice_number") else "No open invoice"
                if is_english:
                    reply = (
                        f"{merchant['name']}: Total pending ₹{merchant['outstanding']:,.0f} "
                        f"({merchant['overdue_days']} days overdue). {inv_str}, Phone: {merchant.get('phone')}. "
                        f"Would you like me to create a payment link?"
                    )
                else:
                    reply = (
                        f"{merchant['name']}: Kul baaki ₹{merchant['outstanding']:,.0f} "
                        f"({merchant['overdue_days']} din overdue). {inv_str}, Phone: {merchant.get('phone')}. "
                        f"Kya aap inka payment link banana chahte hain?"
                    )
            elif not reply:
                reply = "You can ask for shop summary, customer balance, reminders, or create payment links." if is_english else "Aap mujhse hisaab, customer balance, reminder ya Cashfree payment link banane ke liye keh sakte hain."

        state["history"].append({"user": text_str, "assistant": reply})

        # Generate audio using Sarvam TTS with matched language
        audio = ""
        try:
            audio = await self.sarvam.speak(reply, detected_code)
        except Exception as exc:
            logger.warning("TTS generation skipped: %s", exc)

        return {
            "transcript": text_str,
            "reply": reply,
            "language_code": detected_code,
            "action": action,
            "audio": audio,
            "planner": "llm" if used_llm else "rules",
        }

    async def _plan(
        self, text_str: str, state: dict, language_name: str, ctx: Dict[str, Any]
    ) -> Tuple[dict, bool]:
        """Try smart instant rules first for lightning-fast sub-second response; fallback to Sarvam LLM."""
        merchants = ctx.get("merchants", [])
        rule_fast = rule_plan(text_str, state.get("pending"), ctx)
        if rule_fast.get("intent") in ("confirm", "cancel", "advice", "summary", "reminder", "promises", "balance", "list"):
            return rule_fast, False
        if rule_fast.get("intent") == "collect" and (rule_fast.get("amount") or any(m["name"].lower() in text_str.lower() for m in merchants)):
            return rule_fast, False

        try:
            accounts_desc = "\n".join(f"- {describe(m)}" for m in merchants) or "- (none)"
            sys_prompt = f"""You are Vaada's AI Assistant for an Indian shop owner.
CRITICAL LANGUAGE INSTRUCTION:
You MUST reply in {language_name}.
If the user's input is in English, reply in natural, fluent English.
If the user's input is in Hindi, reply in Hindi.
If the user's input is in Kannada, reply in Kannada.
Never reply in Hindi if the user asked in English.

Live Shop Data:
Total Outstanding: ₹{ctx.get('outstanding', 0)}
Total Overdue: ₹{ctx.get('overdue', 0)}
Total Collected: ₹{ctx.get('collected', 0)}
Customers:
{accounts_desc}

Return ONLY JSON:
{{
  "intent": "collect" | "confirm" | "cancel" | "advice" | "summary" | "reminder" | "promises" | "balance" | "list" | "general",
  "account": string | null,
  "amount": number | null,
  "reply": string
}}"""
            pending_desc = f"Pending action awaiting confirmation: {state['pending']}" if state.get("pending") else "None."
            res = await self.sarvam.chat_json(
                sys_prompt, f"Pending: {pending_desc}\nUser said: {text_str}"
            )
            raw_reply = res.get("reply", "")
            if any(bad in raw_reply.lower() for bad in ("authentication", "cannot provide customer", "privacy policy")):
                raise ValueError("LLM refusal detected, switching to verified data engine")

            if res.get("intent") and raw_reply:
                return res, True
        except Exception as exc:
            logger.info("Sarvam LLM fallback to rules: %s", exc)

        plan = rule_plan(text_str, state.get("pending"), ctx)
        return plan, False

    def _prepare(
        self, plan: dict, text_str: str, merchants: list[dict], language_code: str, language_name: str
    ) -> Tuple[Optional[dict], str]:
        query = plan.get("account") or text_str
        merchant, score = find_merchant(query, merchants)
        amount = plan.get("amount") or _amount(text_str)
        is_en = language_code == "en-IN"

        if merchant is None:
            avail = ", ".join(m["name"] for m in merchants[:4])
            msg = f"Customer not found. Available: {avail}" if is_en else f"Customer nahi mila. Hamare paas {avail} uplabdh hain."
            return None, msg

        if amount is None:
            amount = merchant.get("outstanding") or 1000.0

        if amount < 1:
            return None, "Amount must be at least ₹1." if is_en else "Rakam kam se kam 1 rupaya honi chahiye."

        if amount > self.s.max_amount:
            return None, f"Amount exceeds the limit of ₹{self.s.max_amount:.0f}." if is_en else f"Yeh hamari ₹{self.s.max_amount:.0f} ki seema se zyada hai."

        if is_en:
            reply = f"Create a Cashfree payment link of ₹{amount:,.0f} for {merchant['name']}? Please say 'Yes' or 'Cancel'."
        else:
            reply = f"{merchant['name']} ke liye ₹{amount:,.0f} ka Cashfree payment link banayein? Kripya 'Haan' ya 'Cancel' bolein."

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
        is_en = language_code == "en-IN"

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

        if invoice_id:
            from ..database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
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
                session.add(dispatch)

                today = await get_today(session)
                now_dt = datetime.combine(today, datetime.min.time())
                session.add(Event(
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
                await session.commit()

        action = {
            "type": "collect",
            "status": "link_created",
            "merchant": merchant["name"],
            "amount": float(amount),
            "invoice_id": invoice_id,
            "link_url": link_url,
            "reference": link_id,
        }
        if is_en:
            reply = f"Success! A Cashfree payment link of ₹{amount:,.0f} has been created for {merchant['name']}."
        else:
            reply = f"Badhai ho! {merchant['name']} ke liye ₹{amount:,.0f} ka Cashfree payment link ban gaya hai."
        return action, reply
