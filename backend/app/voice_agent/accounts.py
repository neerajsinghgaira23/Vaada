"""
backend/app/voice_agent/accounts.py — Fuzzy match spoken & written names to customers / merchants.
Supports both English and Hindi (Devanagari) script names.
"""
from __future__ import annotations

import difflib
import re

_PUNCT = re.compile(r"[^a-z0-9\u0900-\u0DFF\s]+")

KNOWN_TRANSLATIONS: dict[str, list[str]] = {
    "rahul enterprises": [
        "राहुल एंटरप्राइजेज", "राहुल", "राहुल इंटरप्राइजेज", "राहुल एंटरप्राइज",
        "rahul", "rahul ent", "rahul enterprise", "raahul",
    ],
    "amit stores": [
        "अमित स्टोर्स", "अमित स्टोर", "अमित", "amit", "amit store", "ameet",
    ],
    "meena silks": [
        "मीना सिल्क्स", "मीना सिल्क", "मीना", "meena", "meena silk", "mina silks",
    ],
    "farooq traders": [
        "फारूक ट्रेडर्स", "फारूख ट्रेडर्स", "फारूक", "फारूख", "farooq", "farook", "faruq",
    ],
    "latha fabrics": [
        "लता फैब्रिक्स", "लता फैब्रिक", "लता", "latha", "lata", "lata fabrics",
    ],
    "anand provisions": [
        "आनंद प्रोविजन्स", "आनंद प्रोविजन", "आनंद", "anand", "anand provisions",
    ],
    "sharma general store": [
        "शर्मा जनरल स्टोर", "शर्मा जनरल स्टोर्स", "शर्मा", "sharma", "sharma store",
    ],
    "balaji textiles": [
        "बालाजी टेक्सटाइल्स", "बालाजी", "balaji", "balaji textiles",
    ],
    "ravi stationery": [
        "रवि स्टेशनरी", "रवि", "ravi", "ravi stationery",
    ],
    "kavitha sarees": [
        "कविता साड़ीज", "कविता", "kavitha", "kavita sarees",
    ],
}


def _norm(text: str) -> str:
    text = (text or "").lower().strip()
    text = _PUNCT.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def _score(query: str, candidate: str) -> float:
    if not query or not candidate:
        return 0.0
    if query == candidate:
        return 1.0
    if candidate in query or query in candidate:
        return 0.95
    ratio = difflib.SequenceMatcher(None, query, candidate).ratio()
    q_tokens = set(query.split())
    c_tokens = set(candidate.split())
    overlap = len(q_tokens & c_tokens) / max(len(c_tokens), 1)
    return max(ratio, overlap * 0.95)


def find_merchant(query: str, merchants: list[dict]) -> tuple[dict | None, float]:
    """Return (best merchant, score 0..1). Score below 0.50 means 'no match'."""
    q = _norm(query)
    if not q:
        return None, 0.0
    best: dict | None = None
    best_score = 0.0
    for merchant in merchants:
        names = [merchant["name"], str(merchant.get("id", "")).replace("_", " ")]
        names.extend(merchant.get("aliases") or [])
        
        # Add automatic translations from dictionary
        m_low = merchant["name"].lower()
        if m_low in KNOWN_TRANSLATIONS:
            names.extend(KNOWN_TRANSLATIONS[m_low])

        for name in names:
            score = _score(q, _norm(name))
            if score > best_score:
                best, best_score = merchant, score
    if best_score < 0.50:
        return None, best_score
    return best, best_score


def describe(merchant: dict) -> str:
    """One-line summary used in prompts and UI."""
    bits = [merchant["name"]]
    if merchant.get("outstanding"):
        bits.append(f"due ₹{merchant['outstanding']}")
    if merchant.get("phone"):
        bits.append(f"phone {merchant['phone']}")
    if merchant.get("overdue_days"):
        bits.append(f"{merchant['overdue_days']} days overdue")
    return " - ".join(bits)
