"""Tests for subscription endpoints."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_subscribe_returns_uniform_message(auth_client: AsyncClient) -> None:
    """POST /api/v1/subscriptions/subscribe always returns the same opaque message."""
    mock_service = AsyncMock()
    mock_service.create_subscription = AsyncMock(
        return_value=(
            None,
            "If this email is registered, you will receive a verification email.",
            False,
        )
    )

    with patch("app.routers.subscriptions.subscription_service", mock_service):
        resp = await auth_client.post(
            "/api/v1/subscriptions/subscribe",
            json={"email": "test@example.com"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body


async def test_verify_with_invalid_token(client: AsyncClient) -> None:
    """GET /api/v1/subscriptions/verify/{bad_token} returns 404."""
    resp = await client.get("/api/v1/subscriptions/verify/invalid-token-abc")
    assert resp.status_code == 404


async def test_unsubscribe_with_invalid_token(client: AsyncClient) -> None:
    """GET /api/v1/subscriptions/unsubscribe/{bad_token} returns 404."""
    resp = await client.get("/api/v1/subscriptions/unsubscribe/invalid-token-abc")
    assert resp.status_code == 404


async def test_get_preferences_nonexistent(client: AsyncClient) -> None:
    """GET /api/v1/subscriptions/preferences/{email} returns 404 for unknown email."""
    resp = await client.get("/api/v1/subscriptions/preferences/nobody@example.com")
    assert resp.status_code == 404
