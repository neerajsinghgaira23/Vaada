"""
backend/app/models.py — SQLAlchemy 2.0 ORM models for Vaada.
"""
from __future__ import annotations

import os
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

load_dotenv()


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# businesses
# ---------------------------------------------------------------------------

class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    default_language: Mapped[str] = mapped_column(String(10), nullable=False, default="en", server_default="en")
    min_upfront_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("50"), server_default="50")
    max_days_later: Mapped[int] = mapped_column(BigInteger, nullable=False, default=14, server_default="14")
    discount_allowed_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0")

    # relationships
    customers: Mapped[list["Customer"]] = relationship("Customer", back_populates="business", cascade="all, delete-orphan")
    invoices: Mapped[list["Invoice"]] = relationship("Invoice", back_populates="business", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="business", cascade="all, delete-orphan")
    promises: Mapped[list["Promise"]] = relationship("Promise", back_populates="business", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship("Event", back_populates="business", cascade="all, delete-orphan")
    reminders_log: Mapped[list["ReminderLog"]] = relationship("ReminderLog", back_populates="business", cascade="all, delete-orphan")
    payment_link_dispatches: Mapped[list["PaymentLinkDispatch"]] = relationship("PaymentLinkDispatch", back_populates="business", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# customers
# ---------------------------------------------------------------------------

class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("business_id", "phone", name="uq_customer_business_phone"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(10), nullable=False, default="en", server_default="en")

    business: Mapped["Business"] = relationship("Business", back_populates="customers")
    invoices: Mapped[list["Invoice"]] = relationship("Invoice", back_populates="customer", cascade="all, delete-orphan")
    promises: Mapped[list["Promise"]] = relationship("Promise", back_populates="customer", cascade="all, delete-orphan")
    reminders_log: Mapped[list["ReminderLog"]] = relationship("ReminderLog", back_populates="customer", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# invoices
# ---------------------------------------------------------------------------

class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    number: Mapped[str] = mapped_column(String(100), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="unpaid", server_default="unpaid")
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    business: Mapped["Business"] = relationship("Business", back_populates="invoices")
    customer: Mapped["Customer"] = relationship("Customer", back_populates="invoices")
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")
    promises: Mapped[list["Promise"]] = relationship("Promise", back_populates="invoice", cascade="all, delete-orphan")
    payment_link_dispatches: Mapped[list["PaymentLinkDispatch"]] = relationship("PaymentLinkDispatch", back_populates="invoice", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# payments
# ---------------------------------------------------------------------------

class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    invoice_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(50), nullable=False)
    gateway_reference: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    business: Mapped["Business"] = relationship("Business", back_populates="payments")
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")


# ---------------------------------------------------------------------------
# promises
# ---------------------------------------------------------------------------

class Promise(Base):
    __tablename__ = "promises"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    invoice_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    promised_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    promised_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", server_default="open")
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="text", server_default="text")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    business: Mapped["Business"] = relationship("Business", back_populates="promises")
    customer: Mapped["Customer"] = relationship("Customer", back_populates="promises")
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="promises")
    payment_link_dispatches: Mapped[list["PaymentLinkDispatch"]] = relationship("PaymentLinkDispatch", back_populates="promise")


# ---------------------------------------------------------------------------
# payment_link_dispatches
# ---------------------------------------------------------------------------

class PaymentLinkDispatch(Base):
    __tablename__ = "payment_link_dispatches"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    invoice_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    cashfree_link_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    link_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    qr_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", server_default="draft")
    promise_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("promises.id", ondelete="SET NULL"), nullable=True)

    business: Mapped["Business"] = relationship("Business", back_populates="payment_link_dispatches")
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payment_link_dispatches")
    promise: Mapped[Optional["Promise"]] = relationship("Promise", back_populates="payment_link_dispatches")


# ---------------------------------------------------------------------------
# events
# ---------------------------------------------------------------------------

class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    time: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    actor: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    business: Mapped["Business"] = relationship("Business", back_populates="events")


# ---------------------------------------------------------------------------
# app_settings
# ---------------------------------------------------------------------------

class AppSettings(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


# ---------------------------------------------------------------------------
# reminders_log
# ---------------------------------------------------------------------------

class ReminderLog(Base):
    __tablename__ = "reminders_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    got_reply: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    last_reply_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    business: Mapped["Business"] = relationship("Business", back_populates="reminders_log")
    customer: Mapped["Customer"] = relationship("Customer", back_populates="reminders_log")
