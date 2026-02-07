"""
Subscription service — DB-backed CRUD for email alert subscriptions.
"""
from __future__ import annotations

import logging
import secrets
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import Subscription
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate

logger = logging.getLogger(__name__)

# Uniform message to prevent email enumeration
_SUBSCRIBE_OK_MSG = "If this email is registered, you will receive a verification email."


class SubscriptionService:
    """Business logic for subscription management (no Flask/FastAPI imports)."""

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    async def create_subscription(
        self,
        db: AsyncSession,
        payload: SubscriptionCreate,
    ) -> tuple[Subscription | None, str, bool]:
        """Create or handle duplicate subscriptions.

        Returns:
            (subscription_or_none, user_message, needs_verification_email)
        """
        email = payload.email.lower()
        existing = await self._get_by_email(db, email)

        if existing is not None:
            if existing.is_verified and existing.is_active:
                # Already fully subscribed — return uniform message
                return None, _SUBSCRIBE_OK_MSG, False
            if not existing.is_verified:
                # Resend verification with a fresh token
                existing.verification_token = self._generate_token()
                await db.flush()
                return existing, _SUBSCRIBE_OK_MSG, True
            # Verified but inactive — reactivate with new verification
            existing.is_active = True
            existing.verification_token = self._generate_token()
            existing.is_verified = False
            await db.flush()
            return existing, _SUBSCRIBE_OK_MSG, True

        subscription = Subscription(
            email=email,
            is_verified=False,
            is_active=True,
            verification_token=self._generate_token(),
            unsubscribe_token=self._generate_token(),
            alert_earthquakes=payload.alert_earthquakes,
            alert_hurricanes=payload.alert_hurricanes,
            alert_wildfires=payload.alert_wildfires,
            alert_tornadoes=payload.alert_tornadoes,
            alert_flooding=payload.alert_flooding,
            alert_hail=payload.alert_hail,
            min_earthquake_magnitude=payload.min_earthquake_magnitude,
            min_hurricane_category=payload.min_hurricane_category,
            location_filter=(
                payload.location_filter.model_dump() if payload.location_filter else None
            ),
            max_emails_per_day=payload.max_emails_per_day,
        )
        db.add(subscription)
        await db.flush()
        return subscription, _SUBSCRIBE_OK_MSG, True

    # ------------------------------------------------------------------
    # Verify
    # ------------------------------------------------------------------
    async def verify_subscription(
        self, db: AsyncSession, token: str
    ) -> Subscription | None:
        """Verify a subscription by token. Returns the subscription or None."""
        stmt = select(Subscription).where(
            Subscription.verification_token == token,
            Subscription.is_verified.is_(False),
        )
        result = await db.execute(stmt)
        subscription = result.scalar_one_or_none()

        if subscription is None:
            return None

        subscription.is_verified = True
        subscription.verification_token = None
        await db.flush()
        return subscription

    # ------------------------------------------------------------------
    # Unsubscribe
    # ------------------------------------------------------------------
    async def unsubscribe(
        self, db: AsyncSession, token: str
    ) -> Subscription | None:
        """Deactivate subscription by unsubscribe token."""
        stmt = select(Subscription).where(
            Subscription.unsubscribe_token == token,
        )
        result = await db.execute(stmt)
        subscription = result.scalar_one_or_none()

        if subscription is None:
            return None

        subscription.is_active = False
        await db.flush()
        return subscription

    # ------------------------------------------------------------------
    # Resubscribe
    # ------------------------------------------------------------------
    async def resubscribe(
        self, db: AsyncSession, email: str
    ) -> Subscription | None:
        """Reactivate a previously unsubscribed email."""
        subscription = await self._get_by_email(db, email.lower())
        if subscription is None:
            return None

        subscription.is_active = True
        await db.flush()
        return subscription

    # ------------------------------------------------------------------
    # Preferences
    # ------------------------------------------------------------------
    async def get_preferences(
        self, db: AsyncSession, email: str
    ) -> Subscription | None:
        """Return subscription row for the given email."""
        return await self._get_by_email(db, email.lower())

    async def update_preferences(
        self,
        db: AsyncSession,
        email: str,
        updates: SubscriptionUpdate,
    ) -> Subscription | None:
        """Apply partial updates to subscription preferences."""
        subscription = await self._get_by_email(db, email.lower())
        if subscription is None:
            return None

        for field, value in updates.model_dump(exclude_none=True).items():
            if field == "location_filter" and value is not None:
                value = value if isinstance(value, dict) else value
            setattr(subscription, field, value)

        await db.flush()
        return subscription

    # ------------------------------------------------------------------
    # Active subscribers (for email alerting)
    # ------------------------------------------------------------------
    async def get_active_subscribers(
        self, db: AsyncSession
    ) -> Sequence[Subscription]:
        """Return all verified and active subscriptions."""
        stmt = select(Subscription).where(
            Subscription.is_verified.is_(True),
            Subscription.is_active.is_(True),
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def increment_email_count(
        self, db: AsyncSession, subscription_id: int
    ) -> None:
        """Bump emails_sent_today counter for a subscription."""
        stmt = select(Subscription).where(Subscription.id == subscription_id)
        result = await db.execute(stmt)
        subscription = result.scalar_one_or_none()
        if subscription:
            subscription.emails_sent_today = (subscription.emails_sent_today or 0) + 1
            await db.flush()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    async def _get_by_email(
        self, db: AsyncSession, email: str
    ) -> Subscription | None:
        """Look up a subscription by normalised email."""
        stmt = select(Subscription).where(Subscription.email == email)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    def _generate_token() -> str:
        return secrets.token_urlsafe(32)


# Module-level singleton
subscription_service = SubscriptionService()
