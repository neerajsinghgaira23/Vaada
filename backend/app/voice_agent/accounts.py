"""
backend/app/voice_agent/accounts.py — Fuzzy match spoken names to customers / merchants.
"""
from __future__ import annotations

import difflib
import re

_PUNCT = re.compile(r"[^a-z0-9\u0900-\u0DFF\s]+")


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
        return 0.92
    ratio = difflib.SequenceMatcher(None, query, candidate).ratio()
    q_tokens = set(query.split())
    c_tokens = set(candidate.split())
    overlap = len(q_tokens & c_tokens) / max(len(c_tokens), 1)
    return max(ratio, overlap * 0.95)


def find_merchant(query: str, merchants: list[dict]) -> tuple[dict | None, float]:
    """Return (best merchant, score 0..1). Score below 0.60 means 'no match'."""
    q = _norm(query)
    if not q:
        return None, 0.0
    best: dict | None = None
    best_score = 0.0
    for merchant in merchants:
        names = [merchant["name"], str(merchant["id"]).replace("_", " ")]
        names.extend(merchant.get("aliases") or [])
        for name in names:
            score = _score(q, _norm(name))
            if score > best_score:
                best, best_score = merchant, score
    if best_score < 0.60:
        return None, best_score
    return best, best_score


def describe(merchant: dict) -> str:
    """One-line summary used in prompts and UI."""
    bits = [merchant["name"]]
    if merchant.get("outstanding"):
        bits.append(f"due ₹{merchant['outstanding']}")
    if merchant.get("phone"):
        bits.append(f"phone {merchant['phone']}")
    return " - ".join(bits)
