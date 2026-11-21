"""
backend/tests/test_cashfree.py — Test Cashfree payment link creation,
webhook signature verification (accept/reject), and duplicate webhook handling.
"""
import base64
import hashlib
import hmac
import json
import os
import time
from decimal import Decimal
from unittest.mock import patch

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
async def test_create_payment_link_and_idempotency():
    """Test POST /links creates dispatch, link_url, and handles double-click duplicate."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Fetch businesses to get active business_id
        biz_res = await client.get("/businesses")
        assert biz_res.status_code == 200
        businesses = biz_res.json()
        assert len(businesses) > 0
        b_id = str(businesses[0]["id"])
        headers = {"X-Business-Id": b_id}

        # Fetch an invoice with positive remaining from active business
        inv_res = await client.get("/invoices?status=unpaid", headers=headers)
        assert inv_res.status_code == 200
        items = inv_res.json().get("items", [])
        assert len(items) > 0
        target = next((item for item in items if item["remaining"] > 0), items[0])
        inv_id = target["id"]
        rem_amount = target["remaining"]

        # 1. Create Link (mocking Cashfree external call)
        with patch("backend.app.main.create_cashfree_link") as mock_cf:
            mock_cf.return_value = {
                "cf_link_id": "cf_test_12345",
                "link_id": f"vda_{inv_id}_123",
                "link_status": "ACTIVE",
                "link_currency": "INR",
                "link_amount": float(rem_amount),
                "link_url": f"https://sandbox.cashfree.com/pg/links/vda_{inv_id}_123",
                "qr_code": "data:image/png;base64,mockqr",
            }

            resp = await client.post(
                "/links",
                headers=headers,
                json={"invoice_id": inv_id, "amount": rem_amount},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["cashfree_link_id"] == "cf_test_12345"
            assert data["link_url"] == f"https://sandbox.cashfree.com/pg/links/vda_{inv_id}_123"
            assert data["status"] == "draft"
            dispatch_id = data["dispatch_id"]

            # 2. Test Idempotency (double-click duplicate check)
            resp_dupe = await client.post(
                "/links",
                headers=headers,
                json={"invoice_id": inv_id, "amount": rem_amount},
            )
            assert resp_dupe.status_code == 200
            dupe_data = resp_dupe.json()
            assert dupe_data["dispatch_id"] == dispatch_id
            assert dupe_data.get("reused") is True


@pytest.mark.asyncio
async def test_webhook_signature_reject():
    """Test POST /webhooks/cashfree rejects invalid signature."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = json.dumps({"type": "PAYMENT_LINK_EVENT", "data": {}}).encode("utf-8")
        headers = {
            "x-webhook-signature": "invalid_signature",
            "x-webhook-timestamp": "1700000000",
            "Content-Type": "application/json",
        }
        resp = await client.post("/webhooks/cashfree", content=payload, headers=headers)
        assert resp.status_code == 400
        assert "Invalid Cashfree webhook signature" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_webhook_signature_accept_and_duplicate_ignored():
    """Test valid Cashfree webhook processes payment and duplicate is safely ignored."""
    secret = os.getenv("CASHFREE_CLIENT_SECRET", "CF_SANDBOX_SECRET_KEY")
    timestamp = str(int(time.time()))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Fetch businesses to get active business_id
        biz_res = await client.get("/businesses")
        assert biz_res.status_code == 200
        businesses = biz_res.json()
        assert len(businesses) > 0
        b_id = str(businesses[0]["id"])
        headers = {"X-Business-Id": b_id}

        # Fetch an unpaid invoice from active business
        inv_res = await client.get("/invoices?status=unpaid", headers=headers)
        assert inv_res.status_code == 200
        items = inv_res.json().get("items", [])
        assert len(items) > 0
        inv = next((item for item in items if item["remaining"] > 0), items[0])
        inv_id = inv["id"]

        link_resp = await client.post(
            "/links",
            headers=headers,
            json={"invoice_id": inv_id, "amount": 100},
        )
        assert link_resp.status_code == 200
        link_data = link_resp.json()
        cf_link_id = link_data["cashfree_link_id"]

        # Prepare Webhook Payload
        tx_id = f"tx_cashfree_test_{int(time.time() * 1000)}"
        webhook_dict = {
            "type": "PAYMENT_LINK_EVENT",
            "data": {
                "cf_link_id": cf_link_id,
                "link_id": cf_link_id,
                "link_status": "PAID",
                "link_currency": "INR",
                "link_amount": "100.00",
                "link_amount_paid": "100.00",
                "order": {
                    "order_id": f"order_{tx_id}",
                    "transaction_id": tx_id,
                    "transaction_status": "SUCCESS",
                    "order_amount": "100.00",
                },
                "link_notes": {
                    "invoice_id": str(inv_id),
                    "business_id": b_id,
                },
            },
        }
        raw_body = json.dumps(webhook_dict).encode("utf-8")

        # Compute valid HMAC-SHA256 signature
        signed_payload = timestamp.encode("utf-8") + raw_body
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256,
        ).digest()
        valid_signature = base64.b64encode(computed_hmac).decode("utf-8")

        webhook_headers = {
            "x-webhook-signature": valid_signature,
            "x-webhook-timestamp": timestamp,
            "Content-Type": "application/json",
        }

        # First call: must be accepted and record payment
        resp1 = await client.post("/webhooks/cashfree", content=raw_body, headers=webhook_headers)
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["status"] == "ok"
        assert data1["result"]["status"] == "success"
        assert data1["result"]["gateway_reference"] == tx_id

        # Second call: duplicate transaction_id must be ignored
        resp2 = await client.post("/webhooks/cashfree", content=raw_body, headers=webhook_headers)
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["status"] == "ok"
        assert data2["result"]["status"] == "ignored"
        assert data2["result"]["reason"] == "duplicate_payment_id"
