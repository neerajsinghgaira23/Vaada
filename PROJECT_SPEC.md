# Vaada — Project Specification

> "Others chase invoices. We remember promises."

Vaada is a one-screen web app for an Indian small-business owner waiting for money from customers. It ranks who to chase and why, tracks customer promises (open / kept / broken), and has a Demo Clock to fast-forward time.

## 5 Invariant Rules
1. **Python does all money maths and rules.** Frontend is strictly display & action dispatch.
2. **Money is NUMERIC/Decimal, never float.** All money in database and Python calculation is stored and calculated using Decimal.
3. **Every DB query filters by business_id through ONE helper: `scoped_query(model, business_id)`.** Cross-tenant data leaks are strictly prevented.
4. **All code gets "today" ONLY from `get_today()` in `backend/app/clock.py`** (reads demo date from `app_settings`, else real date). Never call `date.today()` or `datetime.now()` anywhere else in business logic.
5. **Secrets only in `.env`.** All data is demo data, labelled "Demo data" in the UI.

## Database Schema (PostgreSQL 16)
- `businesses`: id, name, owner_name, phone, default_language, min_upfront_percent (50), max_days_later (14), discount_allowed_percent (0)
- `customers`: id, business_id, name, phone, email, preferred_language; UNIQUE(business_id, phone)
- `invoices`: id, business_id, customer_id, number, date, due_date, total NUMERIC(12,2), amount_paid NUMERIC(12,2), status (unpaid/partial/paid), gstin NULL
- `payments`: id, business_id, invoice_id, amount, method, gateway_reference UNIQUE, paid_at
- `payment_link_dispatches`: id, business_id, invoice_id, cashfree_link_id, link_url, qr_code NULL, amount, channel, message, status (draft/sent/paid), promise_id NULL
- `promises`: id, business_id, customer_id, invoice_id, promised_amount, promised_date, status (open/kept/broken), source (text/voice), created_at, resolved_at
- `events`: id, business_id, time, actor (AI/owner/system), action, details JSON
- `app_settings`: key (PK), value (stores 'demo_date')
- `reminders_log`: id, business_id, customer_id, sent_at, got_reply boolean, last_reply_at NULL

## Scoring Algorithm (`backend/app/score.py`)
- Base score: 50
- `+15` if customer ever paid part of any invoice (or `+10` in tuned calibration)
- `+(promises_kept / promises_made) * 20` (0 if no promises made)
- `+10` if replied in last 3 days (or `+5` in tuned calibration)
- `-1` per day overdue after day 7 (max -25)
- `-8` per reminder with no reply (max -16)
- `-10` if has broken promise
- Clamped between 5 and 95
- Chase value = `remaining * score / 100` (rounded to 2 decimal places)
- Labels:
  - Score >= 65: "Quick Win" (Green)
  - Score 35-64: "Follow Up" (Amber)
  - Score < 35: "Escalate" (Red)
- Queue Sort Order:
  - Customers with broken promises first
  - Then sorted by highest Chase Value descending

## Tone Ladder
- **Friendly**: First reminder, no broken promises
- **Firm**: 1 broken promise OR 2+ ignored reminders
- **Final**: 2+ broken promises

## Automated Promise Tracking (`check_promises`)
- Compares open promises with `get_today()`.
- Grace period: 1 day (`promised_date + 1 day`).
- Kept: Paid at least the promised amount by promised date + 1 day grace.
- Broken: Promised date + 1 day grace passed and unpaid.
- Every state change logs an event to the `events` table.
- Runs on dashboard load and after every clock advance.
