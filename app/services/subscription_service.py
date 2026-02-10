"""Subscription service — email alert subscription management.

Synchronous service using Flask-SQLAlchemy's ``db.session``.
Uses a uniform message for operations that might reveal whether an
email address exists (email enumeration prevention).
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select

from app.extensions import db
from app.models.subscription import Subscription
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
)

# Uniform message returned for subscribe / verify / unsubscribe to
# prevent email-address enumeration.
_UNIFORM_MESSAGE = (
    "If this email address is registered, the requested action has been "
    "processed. Please check your inbox."
)


class SubscriptionService:
    """Service layer for managing email alert subscriptions."""

    def create_subscription(
        self,
        data: SubscriptionCreate,
    ) -> tuple[str, bool]:
        """Create a new subscription or return a uniform message.

        If the email already exists the method returns the same message
        to avoid leaking whether the address is registered.

        Args:
            data: Validated subscription creation payload.

        Returns:
            Tuple of (message, created) where *created* is ``True``
            when a new row was inserted.
        """
        existing = db.session.execute(
            select(Subscription).where(Subscription.email == data.email)
        ).scalar_one_or_none()

        if existing is not None:
            return _UNIFORM_MESSAGE, False

        verification_token = secrets.token_urlsafe(32)
        unsubscribe_token = secrets.token_urlsafe(32)

        subscription = Subscription(
            email=data.email,
            is_verified=False,
            verification_token=verification_token,
            unsubscribe_token=unsubscribe_token,
            alert_earthquakes=data.alert_earthquakes,
            alert_hurricanes=data.alert_hurricanes,
            alert_wildfires=data.alert_wildfires,
            alert_tornadoes=data.alert_tornadoes,
            alert_flooding=data.alert_flooding,
            alert_hail=data.alert_hail,
            min_earthquake_magnitude=data.min_earthquake_magnitude,
            min_hurricane_category=data.min_hurricane_category,
            location_filter=(
                data.location_filter.model_dump()
                if data.location_filter
                else None
            ),
            max_emails_per_day=data.max_emails_per_day,
        )
        db.session.add(subscription)
        db.session.commit()
        return verification_token, True

    def verify_subscription(self, token: str) -> str:
        """Mark a subscription as verified using the verification token.

        Args:
            token: The verification token sent by email.

        Returns:
            Uniform message regardless of outcome.
        """
        subscription = db.session.execute(
            select(Subscription).where(
                Subscription.verification_token == token
            )
        ).scalar_one_or_none()

        if subscription is not None:
            subscription.is_verified = True
            subscription.verification_token = None
            db.session.commit()

        return _UNIFORM_MESSAGE

    def unsubscribe(self, token: str) -> str:
        """Deactivate a subscription using the unsubscribe token.

        Args:
            token: The unsubscribe token (sent in every alert email).

        Returns:
            Uniform message regardless of outcome.
        """
        subscription = db.session.execute(
            select(Subscription).where(
                Subscription.unsubscribe_token == token
            )
        ).scalar_one_or_none()

        if subscription is not None:
            subscription.is_active = False
            db.session.commit()

        return _UNIFORM_MESSAGE

    def resubscribe(self, token: str) -> str:
        """Re-activate a previously unsubscribed subscription.

        Args:
            token: The unsubscribe token.

        Returns:
            Uniform message regardless of outcome.
        """
        subscription = db.session.execute(
            select(Subscription).where(
                Subscription.unsubscribe_token == token
            )
        ).scalar_one_or_none()

        if subscription is not None:
            subscription.is_active = True
            db.session.commit()

        return _UNIFORM_MESSAGE

    def get_preferences(
        self,
        subscription_id: int,
    ) -> Optional[SubscriptionResponse]:
        """Retrieve subscription preferences by ID.

        Args:
            subscription_id: Database primary key.

        Returns:
            Serialised ``SubscriptionResponse`` or ``None``.
        """
        subscription = db.session.execute(
            select(Subscription).where(Subscription.id == subscription_id)
        ).scalar_one_or_none()

        if subscription is None:
            return None
        return SubscriptionResponse.model_validate(subscription)

    def update_preferences(
        self,
        subscription_id: int,
        data: SubscriptionUpdate,
    ) -> Optional[SubscriptionResponse]:
        """Update subscription preferences.

        Only fields explicitly set in *data* are modified.

        Args:
            subscription_id: Database primary key.
            data: Partial update payload.

        Returns:
            Updated ``SubscriptionResponse`` or ``None`` if not found.
        """
        subscription = db.session.execute(
            select(Subscription).where(Subscription.id == subscription_id)
        ).scalar_one_or_none()

        if subscription is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field_name, value in update_data.items():
            if field_name == "location_filter" and value is not None:
                value = value if isinstance(value, dict) else value.model_dump()
            setattr(subscription, field_name, value)

        subscription.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        db.session.refresh(subscription)
        return SubscriptionResponse.model_validate(subscription)

    def get_active_subscribers(
        self,
        event_type: Optional[str] = None,
    ) -> List[Subscription]:
        """Return all active, verified subscribers.

        Optionally filters by the specific event type preference flag.

        Args:
            event_type: One of ``"earthquake"``, ``"hurricane"``,
                ``"wildfire"``, ``"tornado"``, ``"flooding"``,
                ``"hail"``.  When provided only subscribers who opted
                into that event type are returned.

        Returns:
            List of ``Subscription`` ORM instances.
        """
        query = (
            select(Subscription)
            .where(Subscription.is_active.is_(True))
            .where(Subscription.is_verified.is_(True))
        )

        event_flag_map = {
            "earthquake": Subscription.alert_earthquakes,
            "hurricane": Subscription.alert_hurricanes,
            "wildfire": Subscription.alert_wildfires,
            "tornado": Subscription.alert_tornadoes,
            "flooding": Subscription.alert_flooding,
            "hail": Subscription.alert_hail,
        }

        if event_type and event_type in event_flag_map:
            query = query.where(event_flag_map[event_type].is_(True))

        return list(db.session.execute(query).scalars().all())

    def increment_email_count(self, subscription_id: int) -> None:
        """Increment the daily email counter for a subscription.

        Resets the counter when the last-email date is not today.

        Args:
            subscription_id: Database primary key.
        """
        subscription = db.session.execute(
            select(Subscription).where(Subscription.id == subscription_id)
        ).scalar_one_or_none()

        if subscription is None:
            return

        now = datetime.now(timezone.utc)

        if (
            subscription.last_email_date is None
            or subscription.last_email_date.date() != now.date()
        ):
            subscription.emails_sent_today = 1
        else:
            subscription.emails_sent_today += 1

        subscription.last_email_date = now
        db.session.commit()
