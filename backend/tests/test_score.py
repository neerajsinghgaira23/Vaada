from decimal import Decimal
from datetime import date
from backend.app.score import compute_score, compute_chase_value, get_label


def test_rahul():
    # Rahul: ever_paid_partial=True, promises_kept=2, promises_made=3, replied=True, days_overdue=4, reminders_no_reply=0, has_broken=False
    score = compute_score(True, 2, 3, True, 4, 0, False)
    assert score == 78, f"Expected 78, got {score}"
    remaining = Decimal("5000")
    cv = compute_chase_value(remaining, score)
    assert cv == Decimal("3900.00"), f"Expected 3900, got {cv}"


def test_amit():
    # Amit: ever_paid_partial=False, promises_kept=0, promises_made=0, replied=False, days_overdue=9, reminders_no_reply=2, has_broken=False
    score = compute_score(False, 0, 0, False, 9, 2, False)
    assert score == 32, f"Expected 32, got {score}"
    remaining = Decimal("8000")
    cv = compute_chase_value(remaining, score)
    assert cv == Decimal("2560.00"), f"Expected 2560, got {cv}"


def test_broken_promise():
    # Customer with broken promise: score should be low
    score = compute_score(False, 0, 1, False, 10, 1, True)
    assert score < 35, f"Expected <35 (Escalate), got {score}"
    assert get_label(score) == "Escalate"
