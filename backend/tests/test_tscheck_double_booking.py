"""Criterion: Double booking prevented server-side and amount from server.

Logs in as the seeded demo user, picks a real open slot for Priya Raghavan (fully
verified demo expert), books it (expecting the server's own price regardless of what
we send), then immediately tries to book the exact same slot again and expects a 409.
"""

import httpx
import pytest

USER_EMAIL = "user@verity.demo"
USER_PASSWORD = "User@1234"


@pytest.fixture
def user_client(client: httpx.Client):
    r = client.post("/auth/login", json={"email": USER_EMAIL, "password": USER_PASSWORD})
    assert r.status_code == 200, r.text
    yield client


def _priya_id(client: httpx.Client) -> str:
    r = client.get("/experts", params={"q": "Priya Raghavan"})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert items, "seed expert Priya Raghavan not found"
    return items[0]["id"]


def _first_open_slot(client: httpx.Client, expert_id: str, duration: int = 30) -> str:
    r = client.get(f"/experts/{expert_id}/slots", params={"duration": duration})
    assert r.status_code == 200, r.text
    days = r.json()
    for day in days:
        for slot in day.get("slots", []):
            # slot entries are ISO start times (string) or dicts with 'start'
            return slot if isinstance(slot, str) else slot["start"]
    pytest.skip("no open slot available for Priya in the next 14 days")


def test_checkout_uses_server_price_and_blocks_double_booking(user_client: httpx.Client):
    expert_id = _priya_id(user_client)
    start_at = _first_open_slot(user_client, expert_id, duration=30)

    # Attempt to cheat the price client-side: server must ignore it and charge its own price_30 (899).
    payload = {
        "expert_id": expert_id,
        "duration_minutes": 30,
        "start_at": start_at,
        "topic": "tscheck-double-booking price probe",
        "client_claimed_amount": 1,
    }
    r1 = user_client.post("/checkout", json=payload)
    assert r1.status_code == 200, r1.text
    body = r1.json()
    payment = body["payment"]
    assert float(payment["amount"]) == 899.0, f"server must charge its own saved price, got {payment}"
    assert float(payment["commission_pct"]) == 12.0, f"default commission should be 12%, got {payment}"
    assert payment["transaction_id"].startswith("DEMO-TXN-")

    # Second checkout for the exact same slot must be rejected (overlap / no longer available).
    r2 = user_client.post("/checkout", json=payload)
    assert r2.status_code == 409, f"expected 409 on double-booking the same slot, got {r2.status_code}: {r2.text}"
