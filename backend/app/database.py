import os
import re
import socket
import subprocess
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from dotenv import load_dotenv

# Load .env from project root (parent of backend/)
_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_root / ".env")


def get_wsl_ip() -> str | None:
    try:
        out = subprocess.check_output(["wsl", "hostname", "-I"], text=True, timeout=2).strip()
        if out:
            return out.split()[0]
    except Exception:
        pass
    return None


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL", "postgresql+asyncpg://vaada:vaada123@localhost:5432/vaadadb")
    wsl_ip = get_wsl_ip()
    if wsl_ip:
        # On Windows with WSL, using the direct virtual IP avoids localhost loopback connection drops
        url = re.sub(r"@(localhost|127\.0\.0\.1):5432", f"@{wsl_ip}:5432", url)
    return url


DATABASE_URL = get_database_url()
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=300,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def scoped_query(model, business_id: int):
    """Filter any query by business_id to enforce multi-tenant isolation."""
    return select(model).where(model.business_id == business_id)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

