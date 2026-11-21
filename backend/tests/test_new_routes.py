import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.database import engine
from backend.seed import seed


@pytest.mark.asyncio
async def test_new_routes_and_tenant_isolation():
    await engine.dispose()
    # Fresh seed
    await seed(keep_businesses=False)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:

        # 1. GET /health
        res = await client.get("/health")
        assert res.status_code == 200
        health_data = res.json()
        assert health_data["status"] == "ok"
        assert health_data["app"] == "Vaada"

        # Fetch businesses
        res = await client.get("/businesses")
        businesses = res.json()
        assert len(businesses) >= 2
        b1_id = businesses[0]["id"]
        b2_id = businesses[1]["id"]
        headers_b1 = {"X-Business-Id": str(b1_id)}
        headers_b2 = {"X-Business-Id": str(b2_id)}

        # 2. GET /customers (Business 1)
        res = await client.get("/customers", headers=headers_b1)
        assert res.status_code == 200
        custs_b1 = res.json()
        assert len(custs_b1) == 5
        rahul = next(c for c in custs_b1 if "Rahul" in c["name"])
        assert rahul["score"] == 78

        # 3. GET /customers/{id} (Customer Detail)
        res = await client.get(f"/customers/{rahul['id']}", headers=headers_b1)
        assert res.status_code == 200
        detail = res.json()
        assert detail["customer"]["name"] == "Rahul Enterprises"
        assert "score_breakdown" in detail
        assert detail["score_breakdown"]["base"] == 50
        assert "invoices" in detail
        assert "promises" in detail
        assert "payments" in detail

        # Multi-tenant test: Business 2 requesting Business 1 customer -> 404
        res = await client.get(f"/customers/{rahul['id']}", headers=headers_b2)
        assert res.status_code == 404

        # 4. GET /invoices
        res = await client.get("/invoices", headers=headers_b1)
        assert res.status_code == 200
        inv_data = res.json()
        assert "items" in inv_data
        assert "total" in inv_data
        assert len(inv_data["items"]) > 0

        # Filter invoices overdue=true
        res_od = await client.get("/invoices?overdue=true", headers=headers_b1)
        assert res_od.status_code == 200

        # GET /invoices/{id}
        first_inv_id = inv_data["items"][0]["id"]
        res_inv = await client.get(f"/invoices/{first_inv_id}", headers=headers_b1)
        assert res_inv.status_code == 200
        assert res_inv.json()["id"] == first_inv_id

        # Multi-tenant test: Business 2 requesting Business 1 invoice -> 404
        res_inv_b2 = await client.get(f"/invoices/{first_inv_id}", headers=headers_b2)
        assert res_inv_b2.status_code == 404

        # 5. GET /promises
        res = await client.get("/promises", headers=headers_b1)
        assert res.status_code == 200
        prom_data = res.json()
        assert "items" in prom_data
        assert "summary" in prom_data
        assert prom_data["summary"]["broken"] >= 1  # Farooq has broken promise

        # 6. GET /analytics
        res = await client.get("/analytics", headers=headers_b1)
        assert res.status_code == 200
        analytics = res.json()
        assert "overdue_buckets" in analytics
        assert "promises_breakdown" in analytics
        assert "score_distribution" in analytics
        assert "top_chase_values" in analytics

        # 7. GET /search
        res = await client.get("/search?q=Rahul", headers=headers_b1)
        assert res.status_code == 200
        search_data = res.json()
        assert len(search_data["customers"]) > 0
        assert "Rahul" in search_data["customers"][0]["name"]

        # Search from Business 2 shouldn't find Rahul
        res_b2_search = await client.get("/search?q=Rahul", headers=headers_b2)
        assert res_b2_search.status_code == 200
        assert len(res_b2_search.json()["customers"]) == 0

        # 8. GET /settings and PUT /settings
        res = await client.get("/settings", headers=headers_b1)
        assert res.status_code == 200
        settings = res.json()
        assert "rules" in settings

        # Valid update
        res_put = await client.put(
            "/settings",
            json={"min_upfront_percent": 60, "max_days_later": 20, "discount_allowed_percent": 3},
            headers=headers_b1,
        )
        assert res_put.status_code == 200
        assert res_put.json()["rules"]["min_upfront_percent"] == 60.0

        # Invalid range validation (> 100 percent)
        res_invalid = await client.put(
            "/settings",
            json={"min_upfront_percent": 150},
            headers=headers_b1,
        )
        assert res_invalid.status_code == 400

        # Invalid range validation (> 60 days)
        res_invalid_days = await client.put(
            "/settings",
            json={"max_days_later": 90},
            headers=headers_b1,
        )
        assert res_invalid_days.status_code == 400

    await engine.dispose()

