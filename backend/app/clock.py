import os
from datetime import date, datetime
from sqlalchemy import select


async def get_today_async(db) -> date:
    try:
        from backend.app.models import AppSettings
    except ImportError:
        from app.models import AppSettings
    result = await db.execute(select(AppSettings).where(AppSettings.key == 'demo_date'))
    row = result.scalar_one_or_none()
    if row and row.value:
        return date.fromisoformat(row.value)
    return date.today()


def get_today_sync(demo_date_str: str | None = None) -> date:
    """For score.py and tests: pass demo_date string or None for real today."""
    if demo_date_str:
        return date.fromisoformat(demo_date_str)
    return date.today()


# Alias used throughout the app — async version for FastAPI endpoints
get_today = get_today_async
