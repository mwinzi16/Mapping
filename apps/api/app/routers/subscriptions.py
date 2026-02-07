"""
Subscription API endpoints for email alerts.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_api_key
from app.core.rate_limit import limiter
from app.core.database import get_db
from app.core.response import success_response
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionMessage,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from app.services.email_service import email_service
from app.services.subscription_service import subscription_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/subscribe", response_model=SubscriptionMessage)
@limiter.limit("5/minute")
async def subscribe(
    request: Request,
    subscription: SubscriptionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key),
):
    """Subscribe to catastrophe alerts.

    A verification email will be sent to confirm the subscription.
    Returns a uniform message regardless of email state to prevent enumeration.
    """
    try:
        sub, message, needs_email = await subscription_service.create_subscription(
            db, subscription
        )

        if needs_email and sub is not None:
            background_tasks.add_task(
                email_service.send_verification_email,
                sub.email,
                sub.verification_token,
            )

        return success_response(SubscriptionMessage(message=message))
    except Exception:
        logger.exception("Error creating subscription")
        raise HTTPException(
            status_code=500,
            detail="An error occurred. Please try again later.",
        )


@router.get("/verify/{token}", response_model=SubscriptionMessage)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """Verify email address using the token from verification email."""
    sub = await subscription_service.verify_subscription(db, token)
    if sub is None:
        raise HTTPException(
            status_code=404, detail="Invalid or expired verification token"
        )
    return success_response(SubscriptionMessage(
        message="Email verified successfully! You will now receive catastrophe alerts."
    ))


@router.get("/unsubscribe/{token}", response_model=SubscriptionMessage)
async def unsubscribe(token: str, db: AsyncSession = Depends(get_db)):
    """Unsubscribe from all alerts using the unsubscribe token."""
    sub = await subscription_service.unsubscribe(db, token)
    if sub is None:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe token")
    return success_response(SubscriptionMessage(
        message="You have been unsubscribed from all catastrophe alerts."
    ))


@router.get("/preferences/{email}", response_model=SubscriptionResponse)
async def get_preferences(email: str, db: AsyncSession = Depends(get_db)):
    """Get current subscription preferences."""
    sub = await subscription_service.get_preferences(db, email)
    if sub is None:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return success_response(SubscriptionResponse.model_validate(sub))


@router.put("/preferences/{email}", response_model=SubscriptionMessage)
@limiter.limit("10/minute")
async def update_preferences(
    request: Request,
    email: str,
    updates: SubscriptionUpdate,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key),
):
    """Update subscription preferences."""
    sub = await subscription_service.update_preferences(db, email, updates)
    if sub is None:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return success_response(SubscriptionMessage(message="Preferences updated successfully!"))


@router.post("/resubscribe/{email}", response_model=SubscriptionMessage)
@limiter.limit("5/minute")
async def resubscribe(
    request: Request,
    email: str,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(get_api_key),
):
    """Reactivate a previously unsubscribed email."""
    sub = await subscription_service.resubscribe(db, email)
    if sub is None:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return success_response(SubscriptionMessage(message="Subscription reactivated!"))
