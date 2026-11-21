"""
backend/reset_demo.py — Truncates all data tables (keeps businesses) and re-seeds.
Resets demo_date to today. Safe to re-run.
Run from project root: python -m backend.reset_demo
"""
from __future__ import annotations

import asyncio
import sys
import os
from datetime import date
from pathlib import Path

_here = Path(__file__).resolve().parent.parent  # project root
if str(_here) not in sys.path:
    sys.path.insert(0, str(_here))

from dotenv import load_dotenv
load_dotenv(_here / ".env")

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import engine, AsyncSessionLocal
from backend.app.models import (
    Base,
    ReminderLog,
    Event,
    PaymentLinkDispatch,
    Payment,
    Promise,
    Invoice,
    Customer,
    AppSettings,
)


async def reset():
    """Truncate all data (keep businesses) then re-run seed logic."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        await session.execute(delete(ReminderLog))
        await session.execute(delete(Event))
        await session.execute(delete(PaymentLinkDispatch))
        await session.execute(delete(Payment))
        await session.execute(delete(Promise))
        await session.execute(delete(Invoice))
        await session.execute(delete(Customer))
        await session.execute(delete(AppSettings))
        await session.commit()
        print("[reset_demo] All data tables truncated (businesses preserved).")

    from backend.seed import seed
    await seed(keep_businesses=True)
    print(f"[reset_demo] Re-seeded successfully. demo_date={date.today().isoformat()}")


if __name__ == "__main__":
    asyncio.run(reset())
