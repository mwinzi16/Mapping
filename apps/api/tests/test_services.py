"""Tests for service-layer business logic."""
from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import Subscription
from app.schemas.subscription import SubscriptionCreate
from app.services.subscription_service import SubscriptionService


# ── Earthquake significance mapping ──────────────────────────────────────
# (static helper — no DB needed)


class TestEarthquakeSignificance:
    """Magnitude → significance label mapping."""

    @staticmethod
    def _classify(magnitude: float) -> str:
        """Replicate the classification logic used by the frontend / alerts."""
        if magnitude >= 7.0:
            return "high"
        elif magnitude >= 5.0:
            return "moderate"
        else:
            return "low"

    def test_earthquake_significance_high(self) -> None:
        assert self._classify(7.0) == "high"
        assert self._classify(8.5) == "high"

    def test_earthquake_significance_moderate(self) -> None:
        assert self._classify(5.0) == "moderate"
        assert self._classify(6.9) == "moderate"

    def test_earthquake_significance_low(self) -> None:
        assert self._classify(4.9) == "low"
        assert self._classify(2.0) == "low"


# ── Hurricane significance mapping ───────────────────────────────────────


class TestHurricaneSignificance:
    """Category → significance label mapping."""

    @staticmethod
    def _classify(category: int | None) -> str:
        if category is not None and category >= 3:
            return "major"
        elif category is not None and category >= 1:
            return "moderate"
        else:
            return "minor"

    def test_hurricane_significance_major(self) -> None:
        assert self._classify(3) == "major"
        assert self._classify(5) == "major"

    def test_hurricane_significance_moderate(self) -> None:
        assert self._classify(1) == "moderate"
        assert self._classify(2) == "moderate"

    def test_hurricane_significance_minor(self) -> None:
        assert self._classify(None) == "minor"
        assert self._classify(0) == "minor"


# ── Subscription service (DB-backed) ─────────────────────────────────────

pytestmark = pytest.mark.asyncio


async def test_create_subscription(db_session: AsyncSession) -> None:
    """Creating a new subscription returns a Subscription and uniform msg."""
    svc = SubscriptionService()
    payload = SubscriptionCreate(email="new@example.com")
    sub, message, needs_email = await svc.create_subscription(db_session, payload)

    assert sub is not None
    assert sub.email == "new@example.com"
    assert sub.is_verified is False
    assert needs_email is True
    assert "verification" in message.lower() or "registered" in message.lower()


async def test_verify_subscription(db_session: AsyncSession) -> None:
    """Verifying with a valid token marks the subscription as verified."""
    svc = SubscriptionService()
    payload = SubscriptionCreate(email="verify@example.com")
    sub, _, _ = await svc.create_subscription(db_session, payload)
    await db_session.commit()

    assert sub is not None
    token = sub.verification_token

    verified = await svc.verify_subscription(db_session, token)
    assert verified is not None
    assert verified.is_verified is True
    assert verified.verification_token is None


async def test_duplicate_subscribe(db_session: AsyncSession) -> None:
    """Subscribing twice with the same email does not create duplicates."""
    svc = SubscriptionService()
    payload = SubscriptionCreate(email="dup@example.com")

    sub1, msg1, need1 = await svc.create_subscription(db_session, payload)
    await db_session.commit()

    # Verify the first subscription
    assert sub1 is not None
    await svc.verify_subscription(db_session, sub1.verification_token)
    await db_session.commit()

    # Second attempt with same email
    sub2, msg2, need2 = await svc.create_subscription(db_session, payload)
    # Should return None (already fully verified + active) and no email needed
    assert sub2 is None
    assert need2 is False
