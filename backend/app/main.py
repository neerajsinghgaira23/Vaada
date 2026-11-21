from fastapi import FastAPI, Header, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload
from datetime import date, timedelta, datetime
from decimal import Decimal
from typing import Optional
import json
import time

try:
    from backend.app.database import get_db
    from backend.app.models import (
        Business, Customer, Invoice, Payment, Promise, Event, AppSettings, ReminderLog, PaymentLinkDispatch
    )
    from backend.app.score import (
        compute_score, compute_chase_value, get_label, get_tone, build_why_line
    )
    from backend.app.clock import get_today
    from backend.app.cashfree import create_cashfree_link, verify_cashfree_signature
    from backend.app.payments import process_payment_record
except ImportError:
    from app.database import get_db
    from app.models import (
        Business, Customer, Invoice, Payment, Promise, Event, AppSettings, ReminderLog, PaymentLinkDispatch
    )
    from app.score import (
        compute_score, compute_chase_value, get_label, get_tone, build_why_line
    )
    from app.clock import get_today
    from app.cashfree import create_cashfree_link, verify_cashfree_signature
    from app.payments import process_payment_record


app = FastAPI(title="Vaada API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


def scoped_query(model, business_id: int):
    return select(model).where(model.business_id == business_id)


async def get_business_id(x_business_id: Optional[str] = Header(None)) -> int:
    if x_business_id is None:
        raise HTTPException(status_code=400, detail="X-Business-Id header required")
    try:
        return int(x_business_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="X-Business-Id must be an integer")


async def check_promises(db: AsyncSession, business_id: int, today: date):
    """Check open promises: mark kept or broken based on payment and grace period."""
    result = await db.execute(
        scoped_query(Promise, business_id).where(Promise.status == 'open')
    )
    promises = result.scalars().all()

    for promise in promises:
        grace_deadline = promise.promised_date + timedelta(days=1)
        if grace_deadline < today:
            # Check if invoice has been paid enough since promise was created
            inv_result = await db.execute(
                select(Invoice).where(Invoice.id == promise.invoice_id)
            )
            invoice = inv_result.scalar_one_or_none()
            if invoice is None:
                continue

            # Check payments made after promise created_at
            pay_result = await db.execute(
                select(func.sum(Payment.amount)).where(
                    and_(
                        Payment.invoice_id == promise.invoice_id,
                        Payment.paid_at >= promise.created_at,
                    )
                )
            )
            paid_since = pay_result.scalar_one_or_none() or Decimal('0')

            if paid_since >= promise.promised_amount:
                promise.status = 'kept'
                promise.resolved_at = datetime.combine(today, datetime.min.time())
                db.add(Event(
                    business_id=business_id,
                    time=datetime.combine(today, datetime.min.time()),
                    actor='system',
                    action='promise_kept',
                    details={'promise_id': promise.id, 'customer_id': promise.customer_id},
                ))
            else:
                promise.status = 'broken'
                promise.resolved_at = datetime.combine(today, datetime.min.time())
                db.add(Event(
                    business_id=business_id,
                    time=datetime.combine(today, datetime.min.time()),
                    actor='system',
                    action='promise_broken',
                    details={'promise_id': promise.id, 'customer_id': promise.customer_id},
                ))

    await db.commit()


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/businesses")
async def list_businesses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Business))
    businesses = result.scalars().all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "owner_name": b.owner_name,
            "phone": b.phone,
            "default_language": b.default_language,
        }
        for b in businesses
    ]


@app.get("/dashboard")
async def get_dashboard(
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    today = await get_today(db)
    await check_promises(db, business_id, today)

    # Outstanding & overdue: unpaid/partial invoices
    inv_result = await db.execute(
        scoped_query(Invoice, business_id).where(Invoice.status.in_(['unpaid', 'partial']))
    )
    invoices = inv_result.scalars().all()

    outstanding = Decimal('0')
    overdue = Decimal('0')
    for inv in invoices:
        remaining = inv.total - inv.amount_paid
        outstanding += remaining
        if inv.due_date < today:
            overdue += remaining

    # Collected
    coll_result = await db.execute(
        select(func.sum(Invoice.amount_paid)).where(Invoice.business_id == business_id)
    )
    collected = coll_result.scalar_one_or_none() or Decimal('0')

    # Promised this week: open promises with promised_date between today and today+7
    week_end = today + timedelta(days=7)
    ptw_result = await db.execute(
        scoped_query(Promise, business_id).where(
            and_(
                Promise.status == 'open',
                Promise.promised_date >= today,
                Promise.promised_date <= week_end,
            )
        )
    )
    ptw_promises = ptw_result.scalars().all()
    promised_this_week = sum(p.promised_amount for p in ptw_promises)

    # Risky promised: open promises where customer has ANY broken promise
    broken_customer_result = await db.execute(
        select(Promise.customer_id).where(
            and_(
                Promise.business_id == business_id,
                Promise.status == 'broken',
            )
        ).distinct()
    )
    broken_customer_ids = {row[0] for row in broken_customer_result.fetchall()}

    risky_result = await db.execute(
        scoped_query(Promise, business_id).where(
            and_(
                Promise.status == 'open',
                Promise.customer_id.in_(broken_customer_ids) if broken_customer_ids else text('false'),
            )
        )
    )
    risky_promises = risky_result.scalars().all()
    risky_promised = sum(p.promised_amount for p in risky_promises) if risky_promises else Decimal('0')

    return {
        "outstanding": float(outstanding),
        "overdue": float(overdue),
        "collected": float(collected),
        "promised_this_week": float(promised_this_week),
        "risky_promised": float(risky_promised),
        "risky_promises": float(risky_promised),
        "today": today.isoformat(),
    }


@app.get("/queue")
async def get_queue(
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    today = await get_today(db)

    # Get all customers with outstanding invoices
    cust_result = await db.execute(scoped_query(Customer, business_id))
    customers = cust_result.scalars().all()

    queue = []

    for customer in customers:
        # Get unpaid/partial invoices — scoped by business_id via scoped_query
        inv_result = await db.execute(
            scoped_query(Invoice, business_id).where(
                and_(
                    Invoice.customer_id == customer.id,
                    Invoice.status.in_(['unpaid', 'partial']),
                )
            )
        )
        invoices = inv_result.scalars().all()

        if not invoices:
            continue

        remaining = sum(inv.total - inv.amount_paid for inv in invoices)
        if remaining <= 0:
            continue

        # days_overdue: max days overdue across invoices
        days_overdue = max(
            (today - inv.due_date).days if inv.due_date < today else 0
            for inv in invoices
        )

        # ever_paid_partial
        ever_paid_partial = any(inv.amount_paid > 0 for inv in invoices)

        # Promises — scoped by business_id via scoped_query
        prom_result = await db.execute(
            scoped_query(Promise, business_id).where(
                Promise.customer_id == customer.id,
            )
        )
        promises = prom_result.scalars().all()

        promises_kept = sum(1 for p in promises if p.status == 'kept')
        promises_made = len(promises)
        has_broken_promise = any(p.status == 'broken' for p in promises)
        broken_count = sum(1 for p in promises if p.status == 'broken')

        # Reminders — scoped by business_id via scoped_query
        rem_result = await db.execute(
            scoped_query(ReminderLog, business_id).where(
                ReminderLog.customer_id == customer.id,
            )
        )
        reminders = rem_result.scalars().all()

        three_days_ago = today - timedelta(days=3)
        replied_last_3_days = any(
            r.got_reply and r.last_reply_at and r.last_reply_at.date() >= three_days_ago
            for r in reminders
        )
        reminders_no_reply = sum(1 for r in reminders if not r.got_reply)

        score = compute_score(
            ever_paid_partial=ever_paid_partial,
            promises_kept=promises_kept,
            promises_made=promises_made,
            replied_last_3_days=replied_last_3_days,
            days_overdue=days_overdue,
            reminders_no_reply=reminders_no_reply,
            has_broken_promise=has_broken_promise,
        )
        chase_value = compute_chase_value(remaining, score)
        label = get_label(score)
        tone = get_tone(broken_count, reminders_no_reply)
        why_line = build_why_line(
            days_overdue=days_overdue,
            ever_paid_partial=ever_paid_partial,
            promises_kept=promises_kept,
            promises_made=promises_made,
            has_broken_promise=has_broken_promise,
            replied_last_3_days=replied_last_3_days,
        )

        # Invoice details
        invoice_list = [
            {
                "id": inv.id,
                "number": inv.number,
                "date": inv.date.isoformat(),
                "due_date": inv.due_date.isoformat(),
                "total": float(inv.total),
                "amount_paid": float(inv.amount_paid),
                "remaining": float(inv.total - inv.amount_paid),
                "status": inv.status,
            }
            for inv in invoices
        ]

        promise_list = [
            {
                "id": p.id,
                "promised_amount": float(p.promised_amount),
                "promised_date": p.promised_date.isoformat(),
                "status": p.status,
            }
            for p in promises
        ]

        main_inv = invoices[0] if invoices else None

        queue.append({
            "customer_id": customer.id,
            "id": customer.id,
            "name": customer.name,
            "customer_name": customer.name,
            "phone": customer.phone,
            "remaining": float(remaining),
            "days_overdue": days_overdue,
            "score": score,
            "chase_value": float(chase_value),
            "label": label,
            "priority": label,
            "tone": tone,
            "why_line": why_line,
            "why": why_line,
            "has_broken_promise": has_broken_promise,
            "ever_paid_partial": ever_paid_partial,
            "promises_kept": promises_kept,
            "promises_made": promises_made,
            "replied_last_3_days": replied_last_3_days,
            "reminders_no_reply": reminders_no_reply,
            "invoice_id": main_inv.id if main_inv else None,
            "invoice_number": main_inv.number if main_inv else None,
            "invoice_date": main_inv.date.isoformat() if main_inv else None,
            "due_date": main_inv.due_date.isoformat() if main_inv else None,
            "total": float(main_inv.total) if main_inv else float(remaining),
            "amount_paid": float(main_inv.amount_paid) if main_inv else 0.0,
            "status": main_inv.status if main_inv else "unpaid",
            "invoices": invoice_list,
            "promises": promise_list,
        })

    # Sort: broken promise customers first, then by chase_value DESC
    queue.sort(key=lambda x: (not x["has_broken_promise"], -x["chase_value"]))

    return queue


@app.get("/demo/date")
async def get_demo_date(db: AsyncSession = Depends(get_db)):
    today = await get_today(db)
    return {"date": today.isoformat()}


@app.post("/demo/advance")
async def advance_demo_date(
    body: dict,
    db: AsyncSession = Depends(get_db),
    business_id: int = Depends(get_business_id),
):
    days = body.get("days", 1)
    if not isinstance(days, int) or days < 1:
        raise HTTPException(status_code=400, detail="days must be a positive integer")

    # Get current demo date via get_today()
    current = await get_today(db)
    new_date = current + timedelta(days=days)

    # Update or insert app_settings row
    result = await db.execute(select(AppSettings).where(AppSettings.key == 'demo_date'))
    row = result.scalar_one_or_none()
    if row:
        row.value = new_date.isoformat()
    else:
        db.add(AppSettings(key='demo_date', value=new_date.isoformat()))

    await db.commit()

    # Run check_promises with the new date
    await check_promises(db, business_id, new_date)

    return {"date": new_date.isoformat()}

@app.get("/events")
async def get_events(
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        scoped_query(Event, business_id)
        .order_by(Event.time.desc())
        .limit(20)
    )
    events = result.scalars().all()
    return [
        {
            "id": e.id,
            "time": e.time.isoformat(),
            "actor": e.actor,
            "action": e.action,
            "details": e.details,
        }
        for e in events
    ]


@app.post("/simulate-paid")
async def simulate_paid(
    body: dict,
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    invoice_id = body.get("invoice_id")
    amount = body.get("amount")

    if not invoice_id or amount is None:
        raise HTTPException(status_code=400, detail="invoice_id and amount required")

    amount_dec = Decimal(str(amount))
    if amount_dec <= Decimal("0"):
        raise HTTPException(status_code=400, detail="amount must be positive")

    res = await process_payment_record(
        db=db,
        business_id=business_id,
        invoice_id=invoice_id,
        amount=amount_dec,
        method="simulated",
        actor="owner",
        event_action="simulate_paid",
    )

    return {
        "invoice_id": invoice_id,
        "amount_paid": res.get("amount_paid"),
        "total": res.get("total"),
        "status": res.get("invoice_status"),
        "message": res.get("message"),
    }


@app.post("/links")
async def create_payment_link_endpoint(
    body: dict,
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    invoice_id = body.get("invoice_id")
    amount = body.get("amount")
    promise_id = body.get("promise_id")

    if not invoice_id or amount is None:
        raise HTTPException(status_code=400, detail="invoice_id and amount are required")

    amount_dec = Decimal(str(amount))
    if amount_dec <= Decimal("0"):
        raise HTTPException(status_code=400, detail="amount must be positive")

    # 1. Fetch invoice
    inv_res = await db.execute(
        scoped_query(Invoice, business_id).where(Invoice.id == invoice_id)
    )
    invoice = inv_res.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Fetch customer
    cust_res = await db.execute(
        scoped_query(Customer, business_id).where(Customer.id == invoice.customer_id)
    )
    customer = cust_res.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    remaining = invoice.total - invoice.amount_paid
    if amount_dec > remaining:
        amount_dec = remaining

    # 2. Prevent double-click duplicates (Idempotency)
    existing_dispatch_res = await db.execute(
        scoped_query(PaymentLinkDispatch, business_id).where(
            and_(
                PaymentLinkDispatch.invoice_id == invoice_id,
                PaymentLinkDispatch.amount == amount_dec,
                PaymentLinkDispatch.promise_id == promise_id,
                PaymentLinkDispatch.status == "draft",
                PaymentLinkDispatch.link_url.isnot(None),
            )
        )
    )
    existing_dispatch = existing_dispatch_res.scalars().first()
    if existing_dispatch:
        return {
            "dispatch_id": existing_dispatch.id,
            "cashfree_link_id": existing_dispatch.cashfree_link_id,
            "link_url": existing_dispatch.link_url,
            "qr_code": existing_dispatch.qr_code,
            "amount": float(existing_dispatch.amount),
            "invoice_id": invoice_id,
            "promise_id": promise_id,
            "status": existing_dispatch.status,
            "reused": True,
        }

    # 3. Create unique link_id
    ts = int(time.time() * 1000)
    p_tag = f"p{promise_id}_" if promise_id else ""
    link_id = f"vda_{invoice_id}_{p_tag}{ts}"

    # 4. Call Cashfree API
    notes = {
        "invoice_id": str(invoice_id),
        "promise_id": str(promise_id or ""),
        "business_id": str(business_id),
    }
    cf_res = await create_cashfree_link(
        link_id=link_id,
        amount=amount_dec,
        purpose=f"Invoice #{invoice.number} Payment",
        customer_name=customer.name,
        customer_phone=customer.phone,
        customer_email=customer.email,
        notes=notes,
    )

    link_url = cf_res.get("link_url")
    qr_code = cf_res.get("qr_code")
    cf_link_id = cf_res.get("cf_link_id", link_id)

    # 5. Save payment_link_dispatches row
    dispatch = PaymentLinkDispatch(
        business_id=business_id,
        invoice_id=invoice_id,
        cashfree_link_id=str(cf_link_id),
        link_url=link_url,
        qr_code=qr_code,
        amount=amount_dec,
        channel="cashfree_link",
        message=f"Payment link of ₹{amount_dec} for Invoice #{invoice.number}",
        status="draft",
        promise_id=promise_id,
    )
    db.add(dispatch)

    # 6. Save events row
    today = await get_today(db)
    now_dt = datetime.combine(today, datetime.min.time())
    db.add(
        Event(
            business_id=business_id,
            time=now_dt,
            actor="owner",
            action="create_payment_link",
            details={
                "invoice_id": invoice_id,
                "promise_id": promise_id,
                "amount": float(amount_dec),
                "cashfree_link_id": str(cf_link_id),
                "link_url": link_url,
            },
        )
    )
    await db.commit()
    await db.refresh(dispatch)

    return {
        "dispatch_id": dispatch.id,
        "cashfree_link_id": dispatch.cashfree_link_id,
        "link_url": dispatch.link_url,
        "qr_code": dispatch.qr_code,
        "amount": float(dispatch.amount),
        "invoice_id": invoice_id,
        "promise_id": promise_id,
        "status": dispatch.status,
    }


@app.post("/webhooks/cashfree")
async def cashfree_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    raw_body = await request.body()
    signature = request.headers.get("x-webhook-signature")
    timestamp = request.headers.get("x-webhook-timestamp")

    if not signature or not timestamp:
        raise HTTPException(status_code=400, detail="Missing webhook signature headers")

    is_valid = verify_cashfree_signature(
        signature=signature,
        timestamp=timestamp,
        raw_body=raw_body,
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid Cashfree webhook signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    data = payload.get("data", {})
    link_id = data.get("link_id")
    cf_link_id = data.get("cf_link_id")
    order = data.get("order", {})
    payment = data.get("payment", {})
    link_notes = data.get("link_notes", {})

    transaction_id = str(
        order.get("transaction_id")
        or payment.get("cf_payment_id")
        or order.get("order_id")
        or (f"cf_link_{cf_link_id}" if cf_link_id else f"cf_{link_id}")
    )

    # 1. Find dispatch in DB
    dispatch = None
    if link_id or cf_link_id:
        conditions = []
        if link_id:
            conditions.append(PaymentLinkDispatch.cashfree_link_id == str(link_id))
        if cf_link_id:
            conditions.append(PaymentLinkDispatch.cashfree_link_id == str(cf_link_id))
        d_res = await db.execute(select(PaymentLinkDispatch).where(or_(*conditions)))
        dispatch = d_res.scalars().first()

    if dispatch:
        business_id = dispatch.business_id
        invoice_id = dispatch.invoice_id
        promise_id = dispatch.promise_id
        dispatch_id = dispatch.id
        amount = dispatch.amount
    else:
        # Fallback to link_notes or order_tags
        invoice_id_str = link_notes.get("invoice_id") or order.get("order_tags", {}).get("invoice_id")
        if not invoice_id_str:
            return {"status": "ignored", "reason": "no_matching_invoice_or_dispatch"}
        invoice_id = int(invoice_id_str)
        business_id = int(link_notes.get("business_id", 1))
        promise_id = int(link_notes.get("promise_id")) if link_notes.get("promise_id") else None
        dispatch_id = None
        amount_val = data.get("link_amount_paid") or order.get("order_amount") or payment.get("payment_amount")
        amount = Decimal(str(amount_val or "0"))

    # If amount explicitly in payload, honor it
    amount_in_payload = data.get("link_amount_paid") or order.get("order_amount") or payment.get("payment_amount")
    if amount_in_payload:
        amount = Decimal(str(amount_in_payload))

    # Process in ONE atomic transaction reusing process_payment_record
    result = await process_payment_record(
        db=db,
        business_id=business_id,
        invoice_id=invoice_id,
        amount=amount,
        method="cashfree",
        gateway_reference=transaction_id,
        promise_id=promise_id,
        dispatch_id=dispatch_id,
        actor="system",
        event_action="cashfree_webhook_payment",
    )

    return {"status": "ok", "result": result}


# ─── New Multi-Page App Routes ───────────────────────────────────────────────

@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    today = await get_today(db)
    return {
        "status": "ok",
        "app": "Vaada",
        "today": today.isoformat(),
        "database": "connected",
    }


@app.get("/customers")
async def list_customers(
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    today = await get_today(db)
    result = await db.execute(scoped_query(Customer, business_id))
    customers = result.scalars().all()

    data = []
    for c in customers:
        # invoices
        inv_res = await db.execute(
            scoped_query(Invoice, business_id).where(Invoice.customer_id == c.id)
        )
        invoices = inv_res.scalars().all()
        total_outstanding = sum(inv.total - inv.amount_paid for inv in invoices if inv.status in ('unpaid', 'partial'))
        total_paid = sum(inv.amount_paid for inv in invoices)

        # promises
        prom_res = await db.execute(
            scoped_query(Promise, business_id).where(Promise.customer_id == c.id)
        )
        promises = prom_res.scalars().all()
        promises_kept = sum(1 for p in promises if p.status == 'kept')
        promises_made = len(promises)
        has_broken_promise = any(p.status == 'broken' for p in promises)
        broken_count = sum(1 for p in promises if p.status == 'broken')

        # reminders
        rem_res = await db.execute(
            scoped_query(ReminderLog, business_id).where(ReminderLog.customer_id == c.id)
        )
        reminders = rem_res.scalars().all()
        three_days_ago = today - timedelta(days=3)
        replied_last_3_days = any(
            r.got_reply and r.last_reply_at and r.last_reply_at.date() >= three_days_ago
            for r in reminders
        )
        reminders_no_reply = sum(1 for r in reminders if not r.got_reply)

        days_overdue = max(
            [(today - inv.due_date).days for inv in invoices if inv.status in ('unpaid', 'partial') and inv.due_date < today] or [0]
        )
        ever_paid_partial = any(inv.amount_paid > 0 for inv in invoices)

        score = compute_score(
            ever_paid_partial=ever_paid_partial,
            promises_kept=promises_kept,
            promises_made=promises_made,
            replied_last_3_days=replied_last_3_days,
            days_overdue=days_overdue,
            reminders_no_reply=reminders_no_reply,
            has_broken_promise=has_broken_promise,
        )
        label = get_label(score)
        tone = get_tone(broken_count, reminders_no_reply)
        why_line = build_why_line(
            days_overdue=days_overdue,
            ever_paid_partial=ever_paid_partial,
            promises_kept=promises_kept,
            promises_made=promises_made,
            has_broken_promise=has_broken_promise,
            replied_last_3_days=replied_last_3_days,
        )

        data.append({
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "email": c.email,
            "preferred_language": c.preferred_language,
            "total_outstanding": float(total_outstanding),
            "total_paid": float(total_paid),
            "invoices_count": len(invoices),
            "promises_kept": promises_kept,
            "promises_made": promises_made,
            "score": score,
            "label": label,
            "tone": tone,
            "why_line": why_line,
            "has_broken_promise": has_broken_promise,
        })

    return data


@app.get("/customers/{customer_id}")
async def get_customer_detail(
    customer_id: int,
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    today = await get_today(db)
    cust_res = await db.execute(
        scoped_query(Customer, business_id).where(Customer.id == customer_id)
    )
    customer = cust_res.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Invoices
    inv_res = await db.execute(
        scoped_query(Invoice, business_id).where(Invoice.customer_id == customer_id).order_by(Invoice.date.desc())
    )
    invoices = inv_res.scalars().all()

    # Promises
    prom_res = await db.execute(
        scoped_query(Promise, business_id).where(Promise.customer_id == customer_id).order_by(Promise.promised_date.desc())
    )
    promises = prom_res.scalars().all()

    # Payments across customer's invoices
    invoice_ids = [inv.id for inv in invoices]
    payments = []
    if invoice_ids:
        pay_res = await db.execute(
            scoped_query(Payment, business_id).where(Payment.invoice_id.in_(invoice_ids)).order_by(Payment.paid_at.desc())
        )
        payments = pay_res.scalars().all()

    # Reminders
    rem_res = await db.execute(
        scoped_query(ReminderLog, business_id).where(ReminderLog.customer_id == customer_id).order_by(ReminderLog.sent_at.desc())
    )
    reminders = rem_res.scalars().all()

    # Metrics for scoring
    promises_kept = sum(1 for p in promises if p.status == 'kept')
    promises_made = len(promises)
    has_broken_promise = any(p.status == 'broken' for p in promises)
    broken_count = sum(1 for p in promises if p.status == 'broken')
    reminders_no_reply = sum(1 for r in reminders if not r.got_reply)
    three_days_ago = today - timedelta(days=3)
    replied_last_3_days = any(
        r.got_reply and r.last_reply_at and r.last_reply_at.date() >= three_days_ago
        for r in reminders
    )
    ever_paid_partial = any(inv.amount_paid > 0 for inv in invoices)
    days_overdue = max(
        [(today - inv.due_date).days for inv in invoices if inv.status in ('unpaid', 'partial') and inv.due_date < today] or [0]
    )

    # Score breakdown components
    score_base = 50
    score_partial = 10 if ever_paid_partial else 0
    score_promises = int((promises_kept / promises_made) * 20) if promises_made > 0 else 0
    score_reply = 5 if replied_last_3_days else 0
    score_overdue_penalty = -min(days_overdue - 7, 25) if days_overdue > 7 else 0
    score_reminders_penalty = -min(reminders_no_reply * 8, 16)
    score_broken_penalty = -10 if has_broken_promise else 0

    score = compute_score(
        ever_paid_partial=ever_paid_partial,
        promises_kept=promises_kept,
        promises_made=promises_made,
        replied_last_3_days=replied_last_3_days,
        days_overdue=days_overdue,
        reminders_no_reply=reminders_no_reply,
        has_broken_promise=has_broken_promise,
    )
    label = get_label(score)
    tone = get_tone(broken_count, reminders_no_reply)
    why_line = build_why_line(
        days_overdue=days_overdue,
        ever_paid_partial=ever_paid_partial,
        promises_kept=promises_kept,
        promises_made=promises_made,
        has_broken_promise=has_broken_promise,
        replied_last_3_days=replied_last_3_days,
    )

    total_outstanding = sum(inv.total - inv.amount_paid for inv in invoices if inv.status in ('unpaid', 'partial'))
    total_paid = sum(inv.amount_paid for inv in invoices)

    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email,
            "preferred_language": customer.preferred_language,
        },
        "score": score,
        "label": label,
        "tone": tone,
        "why_line": why_line,
        "total_outstanding": float(total_outstanding),
        "total_paid": float(total_paid),
        "score_breakdown": {
            "base": score_base,
            "partial_payment_bonus": score_partial,
            "promises_bonus": score_promises,
            "recent_reply_bonus": score_reply,
            "overdue_penalty": score_overdue_penalty,
            "ignored_reminders_penalty": score_reminders_penalty,
            "broken_promise_penalty": score_broken_penalty,
            "final_score": score,
        },
        "invoices": [
            {
                "id": inv.id,
                "number": inv.number,
                "date": inv.date.isoformat(),
                "due_date": inv.due_date.isoformat(),
                "total": float(inv.total),
                "amount_paid": float(inv.amount_paid),
                "remaining": float(inv.total - inv.amount_paid),
                "status": inv.status,
                "days_overdue": max((today - inv.due_date).days, 0) if inv.due_date < today else 0,
            }
            for inv in invoices
        ],
        "promises": [
            {
                "id": p.id,
                "invoice_id": p.invoice_id,
                "promised_amount": float(p.promised_amount),
                "promised_date": p.promised_date.isoformat(),
                "status": p.status,
                "source": p.source,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "resolved_at": p.resolved_at.isoformat() if p.resolved_at else None,
            }
            for p in promises
        ],
        "payments": [
            {
                "id": pay.id,
                "invoice_id": pay.invoice_id,
                "amount": float(pay.amount),
                "method": pay.method,
                "paid_at": pay.paid_at.isoformat() if pay.paid_at else None,
            }
            for pay in payments
        ],
    }


@app.get("/invoices")
async def list_invoices(
    status: Optional[str] = None,
    overdue: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    today = await get_today(db)
    query = scoped_query(Invoice, business_id)

    if status and status.lower() != 'all':
        query = query.where(Invoice.status == status.lower())
    if overdue and overdue.lower() == 'true':
        query = query.where(and_(Invoice.due_date < today, Invoice.status.in_(['unpaid', 'partial'])))
    if from_date:
        try:
            fd = date.fromisoformat(from_date)
            query = query.where(Invoice.date >= fd)
        except ValueError:
            pass
    if to_date:
        try:
            td = date.fromisoformat(to_date)
            query = query.where(Invoice.date <= td)
        except ValueError:
            pass

    # Total count
    count_q = select(func.count()).select_from(query.subquery())
    count_res = await db.execute(count_q)
    total_count = count_res.scalar_one()

    # Pagination & sorting
    offset = (max(page, 1) - 1) * limit
    paged_query = query.order_by(Invoice.due_date.asc()).offset(offset).limit(limit)
    res = await db.execute(paged_query)
    invoices = res.scalars().all()

    # Fetch customer map
    cust_res = await db.execute(scoped_query(Customer, business_id))
    cust_map = {c.id: c.name for c in cust_res.scalars().all()}

    items = []
    for inv in invoices:
        items.append({
            "id": inv.id,
            "number": inv.number,
            "customer_id": inv.customer_id,
            "customer_name": cust_map.get(inv.customer_id, "Unknown"),
            "date": inv.date.isoformat(),
            "due_date": inv.due_date.isoformat(),
            "total": float(inv.total),
            "amount_paid": float(inv.amount_paid),
            "remaining": float(inv.total - inv.amount_paid),
            "status": inv.status,
            "days_overdue": (today - inv.due_date).days if inv.due_date < today and inv.status in ('unpaid', 'partial') else 0,
            "gstin": inv.gstin,
        })

    pages = max((total_count + limit - 1) // limit, 1)
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


@app.get("/invoices/{invoice_id}")
async def get_invoice_detail(
    invoice_id: int,
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    today = await get_today(db)
    inv_res = await db.execute(
        scoped_query(Invoice, business_id).where(Invoice.id == invoice_id)
    )
    inv = inv_res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    cust_res = await db.execute(
        scoped_query(Customer, business_id).where(Customer.id == inv.customer_id)
    )
    customer = cust_res.scalar_one_or_none()

    pay_res = await db.execute(
        scoped_query(Payment, business_id).where(Payment.invoice_id == invoice_id).order_by(Payment.paid_at.desc())
    )
    payments = pay_res.scalars().all()

    prom_res = await db.execute(
        scoped_query(Promise, business_id).where(Promise.invoice_id == invoice_id).order_by(Promise.promised_date.desc())
    )
    promises = prom_res.scalars().all()

    return {
        "id": inv.id,
        "number": inv.number,
        "date": inv.date.isoformat(),
        "due_date": inv.due_date.isoformat(),
        "total": float(inv.total),
        "amount_paid": float(inv.amount_paid),
        "remaining": float(inv.total - inv.amount_paid),
        "status": inv.status,
        "days_overdue": (today - inv.due_date).days if inv.due_date < today and inv.status in ('unpaid', 'partial') else 0,
        "gstin": inv.gstin,
        "customer": {
            "id": customer.id if customer else None,
            "name": customer.name if customer else "Unknown",
            "phone": customer.phone if customer else "",
            "preferred_language": customer.preferred_language if customer else "en",
        },
        "payments": [
            {
                "id": p.id,
                "amount": float(p.amount),
                "method": p.method,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            }
            for p in payments
        ],
        "promises": [
            {
                "id": p.id,
                "promised_amount": float(p.promised_amount),
                "promised_date": p.promised_date.isoformat(),
                "status": p.status,
                "source": p.source,
            }
            for p in promises
        ],
    }


@app.get("/promises")
async def list_promises(
    status: Optional[str] = None,
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    today = await get_today(db)
    query = scoped_query(Promise, business_id)
    if status and status.lower() != 'all':
        query = query.where(Promise.status == status.lower())

    res = await db.execute(query.order_by(Promise.promised_date.asc()))
    promises = res.scalars().all()

    # Load customers and invoices map
    cust_res = await db.execute(scoped_query(Customer, business_id))
    cust_map = {c.id: c.name for c in cust_res.scalars().all()}

    inv_res = await db.execute(scoped_query(Invoice, business_id))
    inv_map = {inv.id: inv.number for inv in inv_res.scalars().all()}

    # All promises for summary counts
    all_prom_res = await db.execute(scoped_query(Promise, business_id))
    all_promises = all_prom_res.scalars().all()

    kept_count = sum(1 for p in all_promises if p.status == 'kept')
    broken_count = sum(1 for p in all_promises if p.status == 'broken')
    open_count = sum(1 for p in all_promises if p.status == 'open')
    resolved_total = kept_count + broken_count
    kept_rate = round((kept_count / resolved_total * 100), 1) if resolved_total > 0 else 0.0

    items = []
    for p in promises:
        items.append({
            "id": p.id,
            "customer_id": p.customer_id,
            "customer_name": cust_map.get(p.customer_id, "Unknown"),
            "invoice_id": p.invoice_id,
            "invoice_number": inv_map.get(p.invoice_id, "—"),
            "promised_amount": float(p.promised_amount),
            "promised_date": p.promised_date.isoformat(),
            "status": p.status,
            "source": p.source,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "resolved_at": p.resolved_at.isoformat() if p.resolved_at else None,
            "is_past_due": p.promised_date < today and p.status == 'open',
        })

    return {
        "items": items,
        "summary": {
            "kept": kept_count,
            "broken": broken_count,
            "open": open_count,
            "total": len(all_promises),
            "kept_rate": kept_rate,
        },
    }


@app.get("/analytics")
async def get_analytics(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    today = await get_today(db)

    # Invoices
    inv_res = await db.execute(scoped_query(Invoice, business_id))
    invoices = inv_res.scalars().all()

    # Promises
    prom_res = await db.execute(scoped_query(Promise, business_id))
    promises = prom_res.scalars().all()

    # Payments
    pay_res = await db.execute(scoped_query(Payment, business_id).order_by(Payment.paid_at.asc()))
    payments = pay_res.scalars().all()

    # 1. Overdue aging buckets
    b_0_7 = {"count": 0, "amount": 0.0}
    b_8_14 = {"count": 0, "amount": 0.0}
    b_15_plus = {"count": 0, "amount": 0.0}

    for inv in invoices:
        if inv.status in ('unpaid', 'partial') and inv.due_date < today:
            days = (today - inv.due_date).days
            rem = float(inv.total - inv.amount_paid)
            if days <= 7:
                b_0_7["count"] += 1
                b_0_7["amount"] += rem
            elif days <= 14:
                b_8_14["count"] += 1
                b_8_14["amount"] += rem
            else:
                b_15_plus["count"] += 1
                b_15_plus["amount"] += rem

    # 2. Daily collected timeline
    daily_collected = {}
    for p in payments:
        if p.paid_at:
            day_str = p.paid_at.date().isoformat()
            daily_collected[day_str] = daily_collected.get(day_str, 0.0) + float(p.amount)
    
    collected_timeline = [
        {"date": k, "amount": round(v, 2)}
        for k, v in sorted(daily_collected.items())
    ]

    # 3. Promises status breakdown
    promises_pie = [
        {"name": "Kept", "value": sum(1 for p in promises if p.status == 'kept'), "fill": "#10b981"},
        {"name": "Broken", "value": sum(1 for p in promises if p.status == 'broken'), "fill": "#ef4444"},
        {"name": "Open", "value": sum(1 for p in promises if p.status == 'open'), "fill": "#f59e0b"},
    ]

    # 4. Queue / Score Distribution & Top 5 Chase Values
    cust_res = await db.execute(scoped_query(Customer, business_id))
    customers = cust_res.scalars().all()

    score_labels = {"Quick Win": 0, "Follow Up": 0, "Escalate": 0}
    ranked_chase = []

    for c in customers:
        c_invs = [i for i in invoices if i.customer_id == c.id and i.status in ('unpaid', 'partial')]
        if not c_invs:
            continue
        rem = sum(i.total - i.amount_paid for i in c_invs)
        if rem <= 0:
            continue

        c_proms = [p for p in promises if p.customer_id == c.id]
        p_kept = sum(1 for p in c_proms if p.status == 'kept')
        p_made = len(c_proms)
        p_broken = any(p.status == 'broken' for p in c_proms)
        days_od = max([(today - i.due_date).days for i in c_invs if i.due_date < today] or [0])
        part_paid = any(i.amount_paid > 0 for i in c_invs)

        s = compute_score(
            ever_paid_partial=part_paid,
            promises_kept=p_kept,
            promises_made=p_made,
            replied_last_3_days=False,
            days_overdue=days_od,
            reminders_no_reply=0,
            has_broken_promise=p_broken,
        )
        lbl = get_label(s)
        score_labels[lbl] = score_labels.get(lbl, 0) + 1
        cv = compute_chase_value(rem, s)
        ranked_chase.append({
            "name": c.name,
            "chase_value": float(cv),
            "remaining": float(rem),
            "score": s,
            "label": lbl,
        })

    ranked_chase.sort(key=lambda x: x["chase_value"], reverse=True)
    top_chase = ranked_chase[:5]

    return {
        "overdue_buckets": [
            {"bucket": "0-7 days", "amount": round(b_0_7["amount"], 2), "count": b_0_7["count"]},
            {"bucket": "8-14 days", "amount": round(b_8_14["amount"], 2), "count": b_8_14["count"]},
            {"bucket": "15+ days", "amount": round(b_15_plus["amount"], 2), "count": b_15_plus["count"]},
        ],
        "collected_timeline": collected_timeline,
        "promises_breakdown": promises_pie,
        "score_distribution": [
            {"label": "Quick Win", "count": score_labels["Quick Win"], "fill": "#10b981"},
            {"label": "Follow Up", "count": score_labels["Follow Up"], "fill": "#f59e0b"},
            {"label": "Escalate", "count": score_labels["Escalate"], "fill": "#ef4444"},
        ],
        "top_chase_values": top_chase,
    }


@app.get("/search")
async def search_all(
    q: Optional[str] = "",
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    query_str = (q or "").strip().lower()
    if not query_str:
        return {"customers": [], "invoices": []}

    # Customers match by name, phone, email
    cust_res = await db.execute(
        scoped_query(Customer, business_id).where(
            or_(
                func.lower(Customer.name).contains(query_str),
                Customer.phone.contains(query_str),
                func.lower(Customer.email).contains(query_str),
            )
        ).limit(10)
    )
    customers = [
        {"id": c.id, "name": c.name, "phone": c.phone, "email": c.email}
        for c in cust_res.scalars().all()
    ]

    # Invoices match by number
    inv_res = await db.execute(
        scoped_query(Invoice, business_id).where(
            func.lower(Invoice.number).contains(query_str)
        ).limit(10)
    )
    invoices = [
        {
            "id": inv.id,
            "number": inv.number,
            "customer_id": inv.customer_id,
            "total": float(inv.total),
            "status": inv.status,
        }
        for inv in inv_res.scalars().all()
    ]

    return {"customers": customers, "invoices": invoices}


@app.get("/settings")
async def get_settings(
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    biz = biz_res.scalar_one_or_none()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    demo_date_res = await db.execute(select(AppSettings).where(AppSettings.key == 'demo_date'))
    row = demo_date_res.scalar_one_or_none()
    demo_date = row.value if row else (await get_today(db)).isoformat()

    return {
        "id": biz.id,
        "name": biz.name,
        "owner_name": biz.owner_name,
        "phone": biz.phone,
        "default_language": biz.default_language,
        "rules": {
            "min_upfront_percent": float(biz.min_upfront_percent),
            "max_days_later": biz.max_days_later,
            "discount_allowed_percent": float(biz.discount_allowed_percent),
        },
        "demo_date": demo_date,
    }


@app.put("/settings")
async def update_settings(
    body: dict,
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    biz = biz_res.scalar_one_or_none()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    # Validate and update rules
    if "min_upfront_percent" in body:
        val = Decimal(str(body["min_upfront_percent"]))
        if val < Decimal("0") or val > Decimal("100"):
            raise HTTPException(status_code=400, detail="min_upfront_percent must be 0-100")
        biz.min_upfront_percent = val

    if "discount_allowed_percent" in body:
        val = Decimal(str(body["discount_allowed_percent"]))
        if val < Decimal("0") or val > Decimal("100"):
            raise HTTPException(status_code=400, detail="discount_allowed_percent must be 0-100")
        biz.discount_allowed_percent = val

    if "max_days_later" in body:
        days = int(body["max_days_later"])
        if days < 0 or days > 60:
            raise HTTPException(status_code=400, detail="max_days_later must be 0-60 days")
        biz.max_days_later = days

    if "default_language" in body:
        biz.default_language = str(body["default_language"]).lower()[:10]

    await db.commit()

    return {
        "message": "Settings updated successfully",
        "rules": {
            "min_upfront_percent": float(biz.min_upfront_percent),
            "max_days_later": biz.max_days_later,
            "discount_allowed_percent": float(biz.discount_allowed_percent),
        },
    }


@app.post("/demo/reset")
async def reset_demo_endpoint(
    body: Optional[dict] = None,
    business_id: int = Depends(get_business_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        from backend.reset_demo import reset
    except ImportError:
        from reset_demo import reset

    await reset()
    today = await get_today(db)
    return {
        "message": "Demo data reset successfully",
        "demo_date": today.isoformat(),
    }

