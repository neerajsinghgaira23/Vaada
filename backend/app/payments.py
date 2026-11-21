"""
backend/app/payments.py — Shared payment processing logic for simulate-paid,
Cashfree webhooks, and payment link settlements.
"""
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .clock import get_today
from .database import scoped_query
from .models import Customer, Event, Invoice, Payment, PaymentLinkDispatch, Promise


async def process_payment_record(
    db: AsyncSession,
    business_id: int,
    invoice_id: int,
    amount: Decimal,
    method: str,
    gateway_reference: Optional[str] = None,
    promise_id: Optional[int] = None,
    dispatch_id: Optional[int] = None,
    actor: str = "owner",
    event_action: str = "payment_received",
) -> Dict[str, Any]:
    """
    Execute payment recording in ONE atomic database transaction.
    Reused identically by:
      - POST /simulate-paid
      - POST /webhooks/cashfree
      - Link resolution flows
    """
    amount_dec = Decimal(str(amount))
    if amount_dec <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    # 1. Check duplicate gateway_reference if provided
    if gateway_reference:
        existing_pmt = await db.execute(
            select(Payment).where(Payment.gateway_reference == gateway_reference)
        )
        if existing_pmt.scalar_one_or_none():
            return {
                "status": "ignored",
                "reason": "duplicate_payment_id",
                "gateway_reference": gateway_reference,
            }

    # 2. Fetch invoice within tenant boundary
    inv_result = await db.execute(
        scoped_query(Invoice, business_id).where(Invoice.id == invoice_id)
    )
    invoice = inv_result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice #{invoice_id} not found")

    remaining = invoice.total - invoice.amount_paid
    if remaining <= Decimal("0"):
        return {
            "status": "ignored",
            "reason": "invoice_already_paid",
            "invoice_id": invoice_id,
            "amount_paid": float(invoice.amount_paid),
            "total": float(invoice.total),
            "invoice_status": invoice.status,
            "message": f"Invoice #{invoice.number} is already paid in full",
        }

    # Cap at remaining
    if amount_dec > remaining:
        amount_dec = remaining

    today = await get_today(db)
    now_dt = datetime.combine(today, datetime.min.time())

    # 3. Create Payment record
    payment = Payment(
        business_id=business_id,
        invoice_id=invoice_id,
        amount=amount_dec,
        method=method,
        gateway_reference=gateway_reference,
        paid_at=now_dt,
    )
    db.add(payment)

    # 4. Update Invoice
    invoice.amount_paid += amount_dec
    if invoice.amount_paid >= invoice.total:
        invoice.status = "paid"
    else:
        invoice.status = "partial"

    # 5. Resolve matching promise
    resolved_promise_id = None
    if promise_id:
        p_res = await db.execute(
            scoped_query(Promise, business_id).where(Promise.id == promise_id)
        )
        prom = p_res.scalar_one_or_none()
        if prom and prom.status == "open":
            prom.status = "kept"
            prom.resolved_at = now_dt
            resolved_promise_id = prom.id
    else:
        # Match an open promise for this invoice
        p_res = await db.execute(
            scoped_query(Promise, business_id).where(
                and_(Promise.invoice_id == invoice_id, Promise.status == "open")
            ).order_by(Promise.promised_date.asc())
        )
        prom = p_res.scalars().first()
        if prom:
            prom.status = "kept"
            prom.resolved_at = now_dt
            resolved_promise_id = prom.id

    # 6. Update PaymentLinkDispatch status
    if dispatch_id:
        d_res = await db.execute(
            scoped_query(PaymentLinkDispatch, business_id).where(
                PaymentLinkDispatch.id == dispatch_id
            )
        )
        disp = d_res.scalar_one_or_none()
        if disp:
            disp.status = "paid"
    elif resolved_promise_id:
        d_res = await db.execute(
            scoped_query(PaymentLinkDispatch, business_id).where(
                and_(
                    PaymentLinkDispatch.promise_id == resolved_promise_id,
                    PaymentLinkDispatch.status != "paid",
                )
            )
        )
        disp = d_res.scalars().first()
        if disp:
            disp.status = "paid"
    else:
        d_res = await db.execute(
            scoped_query(PaymentLinkDispatch, business_id).where(
                and_(
                    PaymentLinkDispatch.invoice_id == invoice_id,
                    PaymentLinkDispatch.status != "paid",
                )
            )
        )
        disp = d_res.scalars().first()
        if disp:
            disp.status = "paid"

    # 7. Write Event audit record
    db.add(
        Event(
            business_id=business_id,
            time=now_dt,
            actor=actor,
            action=event_action,
            details={
                "invoice_id": invoice_id,
                "amount": float(amount_dec),
                "method": method,
                "gateway_reference": gateway_reference,
                "new_status": invoice.status,
                "promise_id": resolved_promise_id,
            },
        )
    )

    await db.commit()

    return {
        "status": "success",
        "invoice_id": invoice_id,
        "amount_paid": float(invoice.amount_paid),
        "total": float(invoice.total),
        "invoice_status": invoice.status,
        "status_code": 200,
        "payment_id": payment.id,
        "gateway_reference": gateway_reference,
        "promise_id": resolved_promise_id,
        "message": f"Payment of ₹{amount_dec} processed successfully ({method})",
    }
