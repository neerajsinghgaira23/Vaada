from decimal import Decimal
from datetime import date


def compute_score(
    ever_paid_partial: bool,
    promises_kept: int,
    promises_made: int,
    replied_last_3_days: bool,
    days_overdue: int,
    reminders_no_reply: int,
    has_broken_promise: bool,
    today: date = None,
) -> int:
    score = 50
    if ever_paid_partial:
        score += 10
    if promises_made > 0:
        score += int((promises_kept / promises_made) * 20)
    if replied_last_3_days:
        score += 5
    if days_overdue > 7:
        score -= min(days_overdue - 7, 25)
    score -= min(reminders_no_reply * 8, 16)
    if has_broken_promise:
        score -= 10
    score = max(5, min(95, score))
    return score


def compute_chase_value(remaining: Decimal, score: int) -> Decimal:
    return (remaining * Decimal(score) / Decimal(100)).quantize(Decimal('0.01'))


def get_label(score: int) -> str:
    if score >= 65:
        return "Quick Win"
    elif score >= 35:
        return "Follow Up"
    else:
        return "Escalate"


def get_tone(broken_promises: int, ignored_reminders: int) -> str:
    if broken_promises >= 2:
        return "Final"
    elif broken_promises == 1 or ignored_reminders >= 2:
        return "Firm"
    else:
        return "Friendly"


def build_why_line(
    days_overdue: int,
    ever_paid_partial: bool,
    promises_kept: int,
    promises_made: int,
    has_broken_promise: bool,
    replied_last_3_days: bool,
) -> str:
    parts = []
    if days_overdue > 0:
        parts.append(f"{days_overdue} day{'s' if days_overdue != 1 else ''} late")
    if ever_paid_partial:
        parts.append("paid part before")
    if promises_made > 0:
        parts.append(f"kept {promises_kept} of {promises_made} promise{'s' if promises_made != 1 else ''}")
    if has_broken_promise:
        parts.append("broke a promise")
    if replied_last_3_days:
        parts.append("replied recently")

    base = ", ".join(parts) if parts else "no payment history"

    if has_broken_promise:
        conclusion = "needs escalation."
    elif promises_kept > 0 and promises_made > 0 and promises_kept == promises_made:
        conclusion = "likely to pay soon."
    elif ever_paid_partial:
        conclusion = "likely to pay soon."
    else:
        conclusion = "follow up recommended."

    return f"{base} → {conclusion}"
