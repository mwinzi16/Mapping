"""
Subscription API endpoints for email alerts.
"""
import secrets
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import EmailStr

from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionUpdate,
    SubscriptionResponse,
    SubscriptionMessage,
)
from app.services.email_service import email_service

router = APIRouter()

# In-memory storage for demo (use database in production)
_subscriptions: dict = {}


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


@router.post("/subscribe", response_model=SubscriptionMessage)
async def subscribe(
    subscription: SubscriptionCreate,
    background_tasks: BackgroundTasks
):
    """
    Subscribe to catastrophe alerts.
    A verification email will be sent to confirm the subscription.
    """
    email = subscription.email.lower()
    
    # Check if already subscribed
    if email in _subscriptions:
        existing = _subscriptions[email]
        if existing.get("is_verified"):
            raise HTTPException(
                status_code=400,
                detail="This email is already subscribed. Use the preferences page to update settings."
            )
        # Resend verification
        background_tasks.add_task(
            email_service.send_verification_email,
            email,
            existing["verification_token"]
        )
        return SubscriptionMessage(
            message="Verification email resent. Please check your inbox."
        )
    
    # Create new subscription
    verification_token = _generate_token()
    unsubscribe_token = _generate_token()
    
    _subscriptions[email] = {
        "id": len(_subscriptions) + 1,
        "email": email,
        "is_verified": False,
        "is_active": True,
        "verification_token": verification_token,
        "unsubscribe_token": unsubscribe_token,
        "alert_earthquakes": subscription.alert_earthquakes,
        "alert_hurricanes": subscription.alert_hurricanes,
        "alert_wildfires": subscription.alert_wildfires,
        "alert_tornadoes": subscription.alert_tornadoes,
        "alert_flooding": subscription.alert_flooding,
        "alert_hail": subscription.alert_hail,
        "min_earthquake_magnitude": subscription.min_earthquake_magnitude,
        "min_hurricane_category": subscription.min_hurricane_category,
        "location_filter": subscription.location_filter.dict() if subscription.location_filter else None,
        "max_emails_per_day": subscription.max_emails_per_day,
        "emails_sent_today": 0,
        "created_at": datetime.utcnow(),
    }
    
    # Send verification email
    background_tasks.add_task(
        email_service.send_verification_email,
        email,
        verification_token
    )
    
    return SubscriptionMessage(
        message="Subscription created! Please check your email to verify your address."
    )


@router.get("/verify/{token}", response_model=SubscriptionMessage)
async def verify_email(token: str):
    """Verify email address using the token from verification email."""
    
    for email, sub in _subscriptions.items():
        if sub.get("verification_token") == token:
            sub["is_verified"] = True
            sub["verification_token"] = None
            return SubscriptionMessage(
                message="Email verified successfully! You will now receive catastrophe alerts."
            )
    
    raise HTTPException(status_code=404, detail="Invalid or expired verification token")


@router.get("/unsubscribe/{token}", response_model=SubscriptionMessage)
async def unsubscribe(token: str):
    """Unsubscribe from all alerts using the unsubscribe token."""
    
    for email, sub in _subscriptions.items():
        if sub.get("unsubscribe_token") == token:
            sub["is_active"] = False
            return SubscriptionMessage(
                message="You have been unsubscribed from all catastrophe alerts."
            )
    
    raise HTTPException(status_code=404, detail="Invalid unsubscribe token")


@router.get("/preferences/{email}", response_model=SubscriptionResponse)
async def get_preferences(email: str):
    """Get current subscription preferences."""
    
    email = email.lower()
    if email not in _subscriptions:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    sub = _subscriptions[email]
    return SubscriptionResponse(**sub)


@router.put("/preferences/{email}", response_model=SubscriptionMessage)
async def update_preferences(email: str, updates: SubscriptionUpdate):
    """Update subscription preferences."""
    
    email = email.lower()
    if email not in _subscriptions:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    sub = _subscriptions[email]
    
    for field, value in updates.dict(exclude_none=True).items():
        if field == "location_filter" and value:
            sub[field] = value.dict() if hasattr(value, 'dict') else value
        else:
            sub[field] = value
    
    return SubscriptionMessage(message="Preferences updated successfully!")


@router.post("/resubscribe/{email}", response_model=SubscriptionMessage)
async def resubscribe(email: str):
    """Reactivate a previously unsubscribed email."""
    
    email = email.lower()
    if email not in _subscriptions:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    sub = _subscriptions[email]
    sub["is_active"] = True
    
    return SubscriptionMessage(message="Subscription reactivated!")


# Helper function for the background alerter
def get_active_subscriptions() -> list:
    """Get all active, verified subscriptions."""
    return [
        sub for sub in _subscriptions.values()
        if sub.get("is_verified") and sub.get("is_active")
    ]
