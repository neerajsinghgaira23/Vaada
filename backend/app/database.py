import os
import socket
import subprocess
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from dotenv import load_dotenv

# Load .env from project root (parent of backend/)
_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_root / ".env")


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL", "postgresql+asyncpg://vaada:vaada123@127.0.0.1:5432/vaadadb")
    # Normalize localhost to 127.0.0.1 on Windows to avoid IPv6 asyncpg resolution issues
    return url.replace("@localhost:5432", "@127.0.0.1:5432")


DATABASE_URL = get_database_url()
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def scoped_query(model, business_id: int):
    """Filter any query by business_id to enforce multi-tenant isolation."""
    return select(model).where(model.business_id == business_id)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

