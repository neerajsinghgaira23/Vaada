import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.database import engine
from backend.seed import seed


@pytest.mark.asyncio
async def test_full_api_flow():
    await engine.dispose()
    # 1. Re-seed to ensure pristine state
    await seed(keep_businesses=False)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # GET /businesses
        res = await client.get("/businesses")
        assert res.status_code == 200
        businesses = res.json()
        assert len(businesses) >= 2
        b1_id = businesses[0]["id"]
        b2_id = businesses[1]["id"]
        assert businesses[0]["name"] == "Sunil Cloth House"
        assert businesses[1]["name"] == "Krishna Stationery & Kirana"

        # GET /dashboard for Business 1
        headers_b1 = {"X-Business-Id": str(b1_id)}
        res = await client.get("/dashboard", headers=headers_b1)
        assert res.status_code == 200
        dash_b1 = res.json()
        assert "outstanding" in dash_b1
        assert "overdue" in dash_b1
        assert "collected" in dash_b1
        assert dash_b1["collected"] > 0, "Collected should not be zero"
        assert "promised_this_week" in dash_b1

        # GET /dashboard for Business 2 (Switching business changes numbers)
        headers_b2 = {"X-Business-Id": str(b2_id)}
        res = await client.get("/dashboard", headers=headers_b2)
        assert res.status_code == 200
        dash_b2 = res.json()
        assert dash_b2["outstanding"] != dash_b1["outstanding"] or dash_b2["collected"] != dash_b1["collected"]

        # GET /queue for Business 1
        res = await client.get("/queue", headers=headers_b1)
        assert res.status_code == 200
        queue = res.json()
        assert len(queue) > 0

        # Verify Rahul Enterprises scores 78 and Amit Stores scores 32
        rahul = next((c for c in queue if "Rahul" in c["name"]), None)
        assert rahul is not None, "Rahul Enterprises must be in queue"
        assert rahul["score"] == 78, f"Expected Rahul score 78, got {rahul['score']}"
        assert rahul["chase_value"] == 3900.0, f"Expected Rahul chase value 3900, got {rahul['chase_value']}"
        assert rahul["label"] == "Quick Win"

        amit = next((c for c in queue if "Amit" in c["name"]), None)
        assert amit is not None, "Amit Stores must be in queue"
        assert amit["score"] == 32, f"Expected Amit score 32, got {amit['score']}"
        assert amit["chase_value"] == 2560.0, f"Expected Amit chase value 2560, got {amit['chase_value']}"
        assert amit["label"] == "Escalate"

        # Broken promise customer first in queue
        first_card = queue[0]
        assert first_card["has_broken_promise"] is True, f"First customer should have broken promise, got {first_card['name']}"

        # GET /demo/date
        res = await client.get("/demo/date")
        assert res.status_code == 200
        initial_date = res.json()["date"]

        # POST /demo/advance +7 days
        res = await client.post("/demo/advance", json={"days": 7}, headers=headers_b1)
        assert res.status_code == 200
        advanced_date = res.json()["date"]
        assert advanced_date > initial_date

        # GET /events — log gets entries
        res = await client.get("/events", headers=headers_b1)
        assert res.status_code == 200
        events = res.json()
        assert len(events) > 0

        # POST /simulate-paid on Rahul raises Collected and updates invoice
        # Find Rahul's unpaid/partial invoice
        res = await client.get("/queue", headers=headers_b1)
        queue_after_adv = res.json()
        rahul_after = next(c for c in queue_after_adv if "Rahul" in c["name"])
        inv = rahul_after["invoices"][0]

        res = await client.post("/simulate-paid", json={"invoice_id": inv["id"], "amount": 1000}, headers=headers_b1)
        assert res.status_code == 200
        paid_res = res.json()
        assert paid_res["status"] in ("partial", "paid")

        # Verify dashboard collected increased
        res = await client.get("/dashboard", headers=headers_b1)
        dash_after_pay = res.json()
        assert dash_after_pay["collected"] >= dash_b1["collected"] + 1000

    await engine.dispose()

