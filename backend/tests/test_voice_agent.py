"""
backend/tests/test_voice_agent.py — Test Sarvam AI Voice Agent turns, confirmation gate,
Cashfree payment link creation, and customer matching.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.database import engine
from backend.app.main import app


@pytest.fixture(autouse=True)
async def cleanup_db_connections():
    await engine.dispose()
    yield
    await engine.dispose()


@pytest.mark.asyncio
async def test_voice_agent_config():
    """Verify Voice Agent config returns database accounts and Sarvam models."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        biz_res = await client.get("/businesses")
        assert biz_res.status_code == 200
        b_id = str(next(b for b in biz_res.json() if "Sunil" in b["name"])["id"])

        res = await client.get("/api/voice-agent/config", headers={"X-Business-Id": b_id})
        assert res.status_code == 200
        data = res.json()
        assert "accounts" in data
        assert len(data["accounts"]) > 0
        assert data["stt_model"] == "saaras:v4"
        assert data["tts_model"] == "bulbul:v3"


@pytest.mark.asyncio
async def test_voice_agent_flow_and_confirmation():
    """Verify full conversational turn: command -> confirmation prompt -> 'haan' -> link created."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        biz_res = await client.get("/businesses")
        assert biz_res.status_code == 200
        b_id = str(next(b for b in biz_res.json() if "Sunil" in b["name"])["id"])
        session_id = "test_voice_sess_1"

        # 1. User says intent: create payment link for Rahul Enterprises
        res1 = await client.post(
            "/api/voice-agent/text",
            headers={"X-Business-Id": b_id},
            json={
                "text": "Rahul Enterprises se 2500 rupaye ka payment link bana do",
                "session_id": session_id,
                "language_code": "hi-IN",
            },
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["action"] is not None
        assert data1["action"]["status"] == "awaiting_confirmation"
        assert data1["action"]["amount"] == 2500.0
        assert "Rahul Enterprises" in data1["reply"]

        # 2. User confirms with 'haan'
        res2 = await client.post(
            "/api/voice-agent/text",
            headers={"X-Business-Id": b_id},
            json={
                "text": "haan",
                "session_id": session_id,
                "language_code": "hi-IN",
            },
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["action"] is not None
        assert data2["action"]["status"] == "link_created"
        assert "link_url" in data2["action"]
        assert "Cashfree" in data2["reply"] or "link" in data2["reply"].lower()


@pytest.mark.asyncio
async def test_voice_agent_list_and_cancel():
    """Verify listing accounts and cancelling a pending request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        biz_res = await client.get("/businesses")
        assert biz_res.status_code == 200
        b_id = str(next(b for b in biz_res.json() if "Sunil" in b["name"])["id"])
        session_id = "test_voice_sess_cancel"

        # List accounts
        res_list = await client.post(
            "/api/voice-agent/text",
            headers={"X-Business-Id": b_id},
            json={
                "text": "kaun kaun se customers pending hain?",
                "session_id": session_id,
                "language_code": "hi-IN",
            },
        )
        assert res_list.status_code == 200
        assert "customers" in res_list.json()["reply"].lower()

        # Create intent then cancel
        await client.post(
            "/api/voice-agent/text",
            headers={"X-Business-Id": b_id},
            json={
                "text": "Meena Silks se 1000 rupaye maango",
                "session_id": session_id,
                "language_code": "hi-IN",
            },
        )

        res_cancel = await client.post(
            "/api/voice-agent/text",
            headers={"X-Business-Id": b_id},
            json={
                "text": "nahi cancel",
                "session_id": session_id,
                "language_code": "hi-IN",
            },
        )
        assert res_cancel.status_code == 200
        reply_lower = res_cancel.json()["reply"].lower()
        assert "radd" in reply_lower or "cancel" in reply_lower or "रद्द" in res_cancel.json()["reply"]
