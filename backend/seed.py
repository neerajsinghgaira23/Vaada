"""
backend/seed.py — Seed database with demo data for Vaada.
Safe to re-run: deletes existing data before inserting.
Run from project root: python -m backend.seed
"""
from __future__ import annotations

import asyncio
import sys
import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

# Allow running as: python -m backend.seed  OR  python backend/seed.py
_here = Path(__file__).resolve().parent.parent  # project root
if str(_here) not in sys.path:
    sys.path.insert(0, str(_here))

from dotenv import load_dotenv
load_dotenv(_here / ".env")

from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import engine, AsyncSessionLocal
from backend.app.models import (
    Base,
    Business,
    Customer,
    Invoice,
    Payment,
    Promise,
    ReminderLog,
    Event,
    AppSettings,
    PaymentLinkDispatch,
)


# ---------------------------------------------------------------------------
# helpers — use date.today() here because seed runs before demo_date is set
# ---------------------------------------------------------------------------

_TODAY = date.today()

def d(days_offset: int):
    """Return a date relative to today."""
    return _TODAY + timedelta(days=days_offset)


def dt(days_offset: int, hour: int = 10):
    """Return a datetime relative to today."""
    return datetime.combine(d(days_offset), datetime.min.time()).replace(hour=hour)


# ---------------------------------------------------------------------------
# clear all data tables (keep businesses intact for reset_demo.py re-use)
# ---------------------------------------------------------------------------

async def clear_data(session: AsyncSession, keep_businesses: bool = False):
    """Delete all rows from data tables in dependency order."""
    await session.execute(delete(ReminderLog))
    await session.execute(delete(Event))
    await session.execute(delete(PaymentLinkDispatch))
    await session.execute(delete(Payment))
    await session.execute(delete(Promise))
    await session.execute(delete(Invoice))
    await session.execute(delete(Customer))
    await session.execute(delete(AppSettings))
    if not keep_businesses:
        await session.execute(delete(Business))
    await session.commit()


# ---------------------------------------------------------------------------
# main seed function
# ---------------------------------------------------------------------------

async def seed(keep_businesses: bool = False):
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        await clear_data(session, keep_businesses=keep_businesses)

        today = _TODAY

        # ===================================================================
        # BUSINESS 1: Sunil Cloth House
        # ===================================================================
        if keep_businesses:
            # Fetch existing business
            from sqlalchemy import select
            result = await session.execute(select(Business).where(Business.name == "Sunil Cloth House"))
            b1 = result.scalar_one_or_none()
            if b1 is None:
                keep_businesses = False  # fall through to create

        if not keep_businesses:
            b1 = Business(
                name="Sunil Cloth House",
                owner_name="Sunil Kumar",
                phone="9876543210",
                default_language="hi",
                min_upfront_percent=Decimal("40"),
                max_days_later=21,
                discount_allowed_percent=Decimal("5"),
            )
            session.add(b1)
            await session.flush()

        # ----- Customers -----
        rahul = Customer(business_id=b1.id, name="Rahul Enterprises", phone="9900001111", preferred_language="hi")
        amit = Customer(business_id=b1.id, name="Amit Stores", phone="9900002222", preferred_language="hi")
        meena = Customer(business_id=b1.id, name="Meena Silks", phone="9900003333", preferred_language="kn")
        farooq = Customer(business_id=b1.id, name="Farooq Traders", phone="9900004444", preferred_language="hi")
        latha = Customer(business_id=b1.id, name="Latha Fabrics", phone="9900005555", preferred_language="en")
        session.add_all([rahul, amit, meena, farooq, latha])
        await session.flush()

        # ---- Rahul Enterprises ----
        # Invoice Rs 7000, Rs 2000 paid, due 4 days ago
        inv_rahul = Invoice(
            business_id=b1.id, customer_id=rahul.id,
            number="SCH-001", date=d(-30), due_date=d(-4),
            total=Decimal("7000"), amount_paid=Decimal("2000"), status="partial",
        )
        session.add(inv_rahul)
        await session.flush()

        # 3 promises: 2 kept, 1 open
        # Kept promise 1 — Rs 1000, promised 20 days ago, paid before promised_date
        p_rahul_1 = Promise(
            business_id=b1.id, customer_id=rahul.id, invoice_id=inv_rahul.id,
            promised_amount=Decimal("1000"), promised_date=d(-18),
            status="kept", source="text",
            created_at=dt(-22), resolved_at=dt(-19),
        )
        # Kept promise 2 — Rs 1000, promised 12 days ago
        p_rahul_2 = Promise(
            business_id=b1.id, customer_id=rahul.id, invoice_id=inv_rahul.id,
            promised_amount=Decimal("1000"), promised_date=d(-10),
            status="kept", source="text",
            created_at=dt(-14), resolved_at=dt(-11),
        )
        # Open promise 3 — Rs 5000, due in 2 days
        p_rahul_3 = Promise(
            business_id=b1.id, customer_id=rahul.id, invoice_id=inv_rahul.id,
            promised_amount=Decimal("5000"), promised_date=d(2),
            status="open", source="text",
            created_at=dt(-2),
        )
        session.add_all([p_rahul_1, p_rahul_2, p_rahul_3])
        await session.flush()

        # Payments corresponding to kept promises
        pay_rahul_1 = Payment(
            business_id=b1.id, invoice_id=inv_rahul.id,
            amount=Decimal("1000"), method="upi",
            paid_at=dt(-19, hour=14),
        )
        pay_rahul_2 = Payment(
            business_id=b1.id, invoice_id=inv_rahul.id,
            amount=Decimal("1000"), method="cash",
            paid_at=dt(-11, hour=11),
        )
        session.add_all([pay_rahul_1, pay_rahul_2])

        # Reminders for Rahul: replied within last 3 days, 0 unreplied reminders
        rem_rahul_1 = ReminderLog(
            business_id=b1.id, customer_id=rahul.id,
            sent_at=dt(-2, hour=9), got_reply=True,
            last_reply_at=dt(-1, hour=16),
        )
        session.add(rem_rahul_1)

        # ---- Amit Stores ----
        # Invoice Rs 8000, Rs 0 paid, due 9 days ago
        inv_amit = Invoice(
            business_id=b1.id, customer_id=amit.id,
            number="SCH-002", date=d(-40), due_date=d(-9),
            total=Decimal("8000"), amount_paid=Decimal("0"), status="unpaid",
        )
        session.add(inv_amit)
        await session.flush()

        # 2 reminders, both got_reply=False
        rem_amit_1 = ReminderLog(
            business_id=b1.id, customer_id=amit.id,
            sent_at=dt(-8, hour=10), got_reply=False,
        )
        rem_amit_2 = ReminderLog(
            business_id=b1.id, customer_id=amit.id,
            sent_at=dt(-4, hour=10), got_reply=False,
        )
        session.add_all([rem_amit_1, rem_amit_2])

        # ---- Meena Silks ----
        # Invoice Rs 12000, Rs 4000 paid, due 2 days ago, preferred_language='kn'
        inv_meena = Invoice(
            business_id=b1.id, customer_id=meena.id,
            number="SCH-003", date=d(-35), due_date=d(-2),
            total=Decimal("12000"), amount_paid=Decimal("4000"), status="partial",
        )
        session.add(inv_meena)
        await session.flush()

        pay_meena_1 = Payment(
            business_id=b1.id, invoice_id=inv_meena.id,
            amount=Decimal("4000"), method="bank_transfer",
            paid_at=dt(-20, hour=15),
        )
        session.add(pay_meena_1)

        # 1 open promise for Rs 4000, due in 3 days
        p_meena_1 = Promise(
            business_id=b1.id, customer_id=meena.id, invoice_id=inv_meena.id,
            promised_amount=Decimal("4000"), promised_date=d(3),
            status="open", source="text",
            created_at=dt(-1),
        )
        session.add(p_meena_1)

        # ---- Farooq Traders ----
        # Invoice Rs 5000, Rs 2000 paid, due 5 days ago
        inv_farooq = Invoice(
            business_id=b1.id, customer_id=farooq.id,
            number="SCH-004", date=d(-25), due_date=d(-5),
            total=Decimal("5000"), amount_paid=Decimal("2000"), status="partial",
        )
        session.add(inv_farooq)
        await session.flush()

        pay_farooq_1 = Payment(
            business_id=b1.id, invoice_id=inv_farooq.id,
            amount=Decimal("2000"), method="cash",
            paid_at=dt(-15, hour=12),
        )
        session.add(pay_farooq_1)

        # 1 promise for Rs 3000, promised last Friday (5 days ago), status='broken'
        p_farooq_1 = Promise(
            business_id=b1.id, customer_id=farooq.id, invoice_id=inv_farooq.id,
            promised_amount=Decimal("3000"), promised_date=d(-5),
            status="broken", source="text",
            created_at=dt(-8),
        )
        session.add(p_farooq_1)

        # ---- Latha Fabrics ----
        # Invoice Rs 6000, Rs 0 paid, due_date = today + 3 days (not overdue)
        inv_latha = Invoice(
            business_id=b1.id, customer_id=latha.id,
            number="SCH-005", date=d(-10), due_date=d(3),
            total=Decimal("6000"), amount_paid=Decimal("0"), status="unpaid",
        )
        session.add(inv_latha)

        # ---- Completed invoice (Rahul Enterprises, 6th invoice) ----
        inv_rahul_paid = Invoice(
            business_id=b1.id, customer_id=rahul.id,
            number="SCH-000", date=d(-60), due_date=d(-45),
            total=Decimal("3000"), amount_paid=Decimal("3000"), status="paid",
        )
        session.add(inv_rahul_paid)
        await session.flush()

        pay_rahul_full = Payment(
            business_id=b1.id, invoice_id=inv_rahul_paid.id,
            amount=Decimal("3000"), method="upi",
            paid_at=dt(-47, hour=16),
        )
        session.add(pay_rahul_full)

        # Events for Business 1
        events_b1 = [
            Event(business_id=b1.id, time=dt(-9, 9), actor="system", action="reminder_sent", details={"customer": "Amit Stores", "channel": "whatsapp"}),
            Event(business_id=b1.id, time=dt(-6, 9), actor="system", action="reminder_sent", details={"customer": "Rahul Enterprises", "channel": "whatsapp"}),
            Event(business_id=b1.id, time=dt(-5, 10), actor="system", action="promise_broken", details={"customer": "Farooq Traders", "amount": 3000}),
            Event(business_id=b1.id, time=dt(-4, 10), actor="system", action="reminder_sent", details={"customer": "Amit Stores", "channel": "whatsapp"}),
            Event(business_id=b1.id, time=dt(-2, 9), actor="system", action="reminder_sent", details={"customer": "Rahul Enterprises", "channel": "whatsapp"}),
            Event(business_id=b1.id, time=dt(-1, 16), actor="customer", action="reply_received", details={"customer": "Rahul Enterprises", "text": "Will pay by Friday"}),
        ]
        session.add_all(events_b1)

        await session.flush()

        # ===================================================================
        # BUSINESS 2: Krishna Stationery & Kirana
        # ===================================================================
        if keep_businesses:
            from sqlalchemy import select
            result2 = await session.execute(select(Business).where(Business.name == "Krishna Stationery & Kirana"))
            b2 = result2.scalar_one_or_none()
            if b2 is None:
                b2 = Business(
                    name="Krishna Stationery & Kirana",
                    owner_name="Krishna Reddy",
                    phone="9876500001",
                    default_language="te",
                    min_upfront_percent=Decimal("30"),
                    max_days_later=10,
                    discount_allowed_percent=Decimal("2"),
                )
                session.add(b2)
                await session.flush()
        else:
            b2 = Business(
                name="Krishna Stationery & Kirana",
                owner_name="Krishna Reddy",
                phone="9876500001",
                default_language="te",
                min_upfront_percent=Decimal("30"),
                max_days_later=10,
                discount_allowed_percent=Decimal("2"),
            )
            session.add(b2)
            await session.flush()

        # ----- 5 Customers -----
        # 1. Pavan School (overdue, partial)
        pavan = Customer(business_id=b2.id, name="Pavan School Supplies", phone="8800001111", preferred_language="te")
        # 2. Sridhar Medical (overdue, unpaid)
        sridhar = Customer(business_id=b2.id, name="Sridhar Medical Stores", phone="8800002222", preferred_language="te")
        # 3. Nirmala Enterprises (partial, not overdue)
        nirmala = Customer(business_id=b2.id, name="Nirmala Enterprises", phone="8800003333", preferred_language="en")
        # 4. Ravi Supermarket (paid, completed)
        ravi = Customer(business_id=b2.id, name="Ravi Supermarket", phone="8800004444", preferred_language="te")
        # 5. Deepa Traders (overdue, unpaid, broken promise)
        deepa = Customer(business_id=b2.id, name="Deepa Traders", phone="8800005555", preferred_language="hi")
        session.add_all([pavan, sridhar, nirmala, ravi, deepa])
        await session.flush()

        # Pavan School: Rs 4500, Rs 1500 paid, due 7 days ago (partial overdue)
        inv_pavan = Invoice(
            business_id=b2.id, customer_id=pavan.id,
            number="KSK-001", date=d(-45), due_date=d(-7),
            total=Decimal("4500"), amount_paid=Decimal("1500"), status="partial",
        )
        session.add(inv_pavan)
        await session.flush()
        pay_pavan = Payment(business_id=b2.id, invoice_id=inv_pavan.id, amount=Decimal("1500"), method="upi", paid_at=dt(-30, 11))
        p_pavan = Promise(
            business_id=b2.id, customer_id=pavan.id, invoice_id=inv_pavan.id,
            promised_amount=Decimal("3000"), promised_date=d(1),
            status="open", source="text", created_at=dt(-3),
        )
        rem_pavan = ReminderLog(business_id=b2.id, customer_id=pavan.id, sent_at=dt(-5, 9), got_reply=True, last_reply_at=dt(-3, 15))
        session.add_all([pay_pavan, p_pavan, rem_pavan])

        # Sridhar Medical: Rs 11200, Rs 0 paid, due 12 days ago (unpaid overdue)
        inv_sridhar = Invoice(
            business_id=b2.id, customer_id=sridhar.id,
            number="KSK-002", date=d(-50), due_date=d(-12),
            total=Decimal("11200"), amount_paid=Decimal("0"), status="unpaid",
        )
        session.add(inv_sridhar)
        await session.flush()
        rem_sridhar_1 = ReminderLog(business_id=b2.id, customer_id=sridhar.id, sent_at=dt(-11, 10), got_reply=False)
        rem_sridhar_2 = ReminderLog(business_id=b2.id, customer_id=sridhar.id, sent_at=dt(-6, 10), got_reply=False)
        session.add_all([rem_sridhar_1, rem_sridhar_2])

        # Nirmala Enterprises: Rs 7300, Rs 3000 paid, due in 5 days (partial, not overdue)
        inv_nirmala = Invoice(
            business_id=b2.id, customer_id=nirmala.id,
            number="KSK-003", date=d(-20), due_date=d(5),
            total=Decimal("7300"), amount_paid=Decimal("3000"), status="partial",
        )
        session.add(inv_nirmala)
        await session.flush()
        pay_nirmala = Payment(business_id=b2.id, invoice_id=inv_nirmala.id, amount=Decimal("3000"), method="bank_transfer", paid_at=dt(-10, 14))
        session.add(pay_nirmala)

        # Ravi Supermarket: Rs 9800, Rs 9800 paid, status='paid' (completed)
        inv_ravi = Invoice(
            business_id=b2.id, customer_id=ravi.id,
            number="KSK-004", date=d(-60), due_date=d(-40),
            total=Decimal("9800"), amount_paid=Decimal("9800"), status="paid",
        )
        session.add(inv_ravi)
        await session.flush()
        pay_ravi = Payment(business_id=b2.id, invoice_id=inv_ravi.id, amount=Decimal("9800"), method="upi", paid_at=dt(-42, 10))
        session.add(pay_ravi)

        # Deepa Traders: Rs 6600, Rs 0 paid, due 3 days ago, broken promise
        inv_deepa = Invoice(
            business_id=b2.id, customer_id=deepa.id,
            number="KSK-005", date=d(-28), due_date=d(-3),
            total=Decimal("6600"), amount_paid=Decimal("0"), status="unpaid",
        )
        session.add(inv_deepa)
        await session.flush()
        p_deepa = Promise(
            business_id=b2.id, customer_id=deepa.id, invoice_id=inv_deepa.id,
            promised_amount=Decimal("6600"), promised_date=d(-3),
            status="broken", source="text", created_at=dt(-6),
        )
        rem_deepa = ReminderLog(business_id=b2.id, customer_id=deepa.id, sent_at=dt(-4, 9), got_reply=False)
        session.add_all([p_deepa, rem_deepa])

        # Events for Business 2
        events_b2 = [
            Event(business_id=b2.id, time=dt(-11, 10), actor="system", action="reminder_sent", details={"customer": "Sridhar Medical Stores", "channel": "whatsapp"}),
            Event(business_id=b2.id, time=dt(-6, 10), actor="system", action="reminder_sent", details={"customer": "Sridhar Medical Stores", "channel": "whatsapp"}),
            Event(business_id=b2.id, time=dt(-5, 9), actor="system", action="reminder_sent", details={"customer": "Pavan School Supplies", "channel": "whatsapp"}),
            Event(business_id=b2.id, time=dt(-4, 9), actor="system", action="reminder_sent", details={"customer": "Deepa Traders", "channel": "whatsapp"}),
            Event(business_id=b2.id, time=dt(-3, 10), actor="system", action="promise_broken", details={"customer": "Deepa Traders", "amount": 6600}),
            Event(business_id=b2.id, time=dt(-3, 15), actor="customer", action="reply_received", details={"customer": "Pavan School Supplies", "text": "Will pay next week"}),
        ]
        session.add_all(events_b2)

        # ===================================================================
        # app_settings: demo_date
        # ===================================================================
        demo_setting = AppSettings(key="demo_date", value=today.strftime("%Y-%m-%d"))
        session.add(demo_setting)

        await session.commit()
        print(f"[seed] Done! demo_date={today.strftime('%Y-%m-%d')}")


if __name__ == "__main__":
    asyncio.run(seed())
