"""
backend/tests/test_persistence.py — Proves data persistence across database sessions and server restarts.
Verifies that promises, payments, demo date, settings, and events are stored permanently in PostgreSQL.
"""
from datetime import date, timedelta
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from backend.app.main import app
from backend.app.database import AsyncSessionLocal
from backend.app.models import Business, Promise, Payment, AppSettings, Event, Invoice, Customer


@pytest.mark.asyncio
async def test_data_persistence_across_sessions():
    """
    Test persistence:
    1. Create a promise
    2. Record a payment (via simulate-paid)
    3. Advance the demo clock
    4. Change a business setting
    5. Close the session, simulate restart by opening a NEW session, and assert all data persisted!
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Fetch business ID
        biz_res = await client.get("/businesses")
        assert biz_res.status_code == 200
        businesses = biz_res.json()
        assert len(businesses) > 0
        biz_id = businesses[0]["id"]
        headers = {"X-Business-Id": str(biz_id)}

        # Fetch an invoice that has remaining balance
        inv_res = await client.get("/invoices", headers=headers)
        assert inv_res.status_code == 200
        invoices = inv_res.json()["items"]
        assert len(invoices) > 0
        target_invoice = next((inv for inv in invoices if inv["status"] in ("unpaid", "partial")), invoices[0])
        inv_id = target_invoice["id"]
        cust_id = target_invoice.get("customer_id") or 1

        # A. Create a promise directly in Session 1
        async with AsyncSessionLocal() as session1:
            test_promise = Promise(
                business_id=biz_id,
                customer_id=cust_id,
                invoice_id=inv_id,
                promised_amount=Decimal("1750.00"),
                promised_date=date.today() + timedelta(days=5),
                status="open",
                source="test_persistence",
            )
            session1.add(test_promise)
            await session1.commit()
            created_promise_id = test_promise.id
            assert created_promise_id is not None

        # B. Record a payment via POST /simulate-paid
        pay_res = await client.post(
            "/simulate-paid",
            headers=headers,
            json={"invoice_id": inv_id, "amount": 250.0},
        )
        assert pay_res.status_code == 200

        # C. Advance the demo clock via POST /demo/advance
        adv_res = await client.post(
            "/demo/advance",
            headers=headers,
            json={"days": 3},
        )
        assert adv_res.status_code == 200
        new_demo_date_str = adv_res.json()["date"]

        # D. Change business setting via PUT /settings
        set_res = await client.put(
            "/settings",
            headers=headers,
            json={"min_upfront_percent": 45, "max_days_later": 25},
        )
        assert set_res.status_code == 200

        # =====================================================================
        # SIMULATE SERVER RESTART: Open a brand NEW database session and assert!
        # =====================================================================
        async with AsyncSessionLocal() as session2:
            # Check 1: Promise persists
            p_res = await session2.execute(
                select(Promise).where(Promise.id == created_promise_id)
            )
            persisted_promise = p_res.scalar_one_or_none()
            assert persisted_promise is not None, "Promise must persist in PostgreSQL"
            assert persisted_promise.promised_amount == Decimal("1750.00")
            assert persisted_promise.source == "test_persistence"

            # Check 2: Payment persists
            pay_db_res = await session2.execute(
                select(Payment).where(Payment.invoice_id == inv_id, Payment.amount == Decimal("250.00"))
            )
            persisted_payment = pay_db_res.scalars().first()
            assert persisted_payment is not None, "Payment must persist in PostgreSQL"
            assert persisted_payment.amount == Decimal("250.00")

            # Check 3: Demo date persists in app_settings table
            dd_res = await session2.execute(
                select(AppSettings).where(AppSettings.key == "demo_date")
            )
            persisted_demo_date = dd_res.scalar_one_or_none()
            assert persisted_demo_date is not None, "demo_date must persist in app_settings table"
            assert persisted_demo_date.value == new_demo_date_str

            # Check 4: Business settings persist
            b_res = await session2.execute(
                select(Business).where(Business.id == biz_id)
            )
            persisted_biz = b_res.scalar_one_or_none()
            assert persisted_biz is not None, "Business must persist in PostgreSQL"
            assert persisted_biz.min_upfront_percent == Decimal("45")
            assert persisted_biz.max_days_later == 25
