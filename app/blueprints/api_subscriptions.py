"""Subscription API blueprint — email alert subscription management."""
from __future__ import annotations

import logging
import threading

from flask import Blueprint, abort, jsonify, request

from app.core.auth import require_api_key
from app.core.response import error_response, success_response
from app.extensions import db, limiter
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionMessage,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from app.services.email_service import EmailService
from app.services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

bp = Blueprint("subscriptions", __name__)

# Module-level singletons
subscription_service = SubscriptionService()
email_service = EmailService()


@bp.route("/subscribe", methods=["POST"])
@limiter.limit("5/minute")
@require_api_key
def subscribe() -> tuple:
    """Subscribe to catastrophe alerts.

    A verification email will be sent to confirm the subscription.
    Returns a uniform message regardless of email state to prevent
    enumeration.

    Request body (JSON):
        See ``SubscriptionCreate`` schema.

    Returns:
        JSON message confirming the request was processed.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify(error_response("VALIDATION_ERROR", "Request body is required")), 400

    try:
        data = SubscriptionCreate(**body)
    except Exception as exc:
        return jsonify(error_response("VALIDATION_ERROR", str(exc))), 400

    try:
        token_or_message, created = subscription_service.create_subscription(data)

        if created:
            # Send verification email in a background thread
            thread = threading.Thread(
                target=email_service.send_verification_email,
                args=(data.email, token_or_message),
                daemon=True,
            )
            thread.start()

        return jsonify(success_response(
            SubscriptionMessage(
                message="If this email address is registered, the requested "
                "action has been processed. Please check your inbox."
            ).model_dump()
        )), 200
    except Exception:
        logger.exception("Error creating subscription")
        return jsonify(error_response(
            "INTERNAL_ERROR",
            "An error occurred. Please try again later.",
        )), 500


@bp.route("/verify/<string:token>", methods=["GET"])
def verify_email(token: str) -> tuple:
    """Verify email address using the token from verification email.

    Args:
        token: The verification token sent by email.

    Returns:
        JSON confirmation message.
    """
    message = subscription_service.verify_subscription(token)

    return jsonify(success_response(
        SubscriptionMessage(
            message="Email verified successfully! You will now receive "
            "catastrophe alerts."
        ).model_dump()
    )), 200


@bp.route("/unsubscribe/<string:token>", methods=["GET"])
def unsubscribe(token: str) -> tuple:
    """Unsubscribe from all alerts using the unsubscribe token.

    Args:
        token: The unsubscribe token (sent in every alert email).

    Returns:
        JSON confirmation message.
    """
    message = subscription_service.unsubscribe(token)

    return jsonify(success_response(
        SubscriptionMessage(
            message="You have been unsubscribed from all catastrophe alerts."
        ).model_dump()
    )), 200


@bp.route("/preferences/<string:email>", methods=["GET"])
@require_api_key
def get_preferences(email: str) -> tuple:
    """Get current subscription preferences by email.

    Args:
        email: The subscriber's email address.

    Returns:
        JSON subscription preferences.
    """
    from sqlalchemy import select

    from app.models.subscription import Subscription

    subscription = db.session.execute(
        select(Subscription).where(Subscription.email == email)
    ).scalar_one_or_none()

    if subscription is None:
        abort(404, description="Subscription not found")

    response = SubscriptionResponse.model_validate(subscription)
    return jsonify(success_response(response.model_dump())), 200


@bp.route("/preferences/<string:email>", methods=["PUT"])
@limiter.limit("10/minute")
@require_api_key
def update_preferences(email: str) -> tuple:
    """Update subscription preferences by email.

    Args:
        email: The subscriber's email address.

    Request body (JSON):
        See ``SubscriptionUpdate`` schema.

    Returns:
        JSON confirmation message.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify(error_response("VALIDATION_ERROR", "Request body is required")), 400

    try:
        updates = SubscriptionUpdate(**body)
    except Exception as exc:
        return jsonify(error_response("VALIDATION_ERROR", str(exc))), 400

    from sqlalchemy import select

    from app.models.subscription import Subscription

    subscription = db.session.execute(
        select(Subscription).where(Subscription.email == email)
    ).scalar_one_or_none()

    if subscription is None:
        abort(404, description="Subscription not found")

    result = subscription_service.update_preferences(
        subscription.id, updates
    )
    if result is None:
        abort(404, description="Subscription not found")

    return jsonify(success_response(
        SubscriptionMessage(message="Preferences updated successfully!").model_dump()
    )), 200


@bp.route("/resubscribe/<string:email>", methods=["POST"])
@limiter.limit("5/minute")
@require_api_key
def resubscribe(email: str) -> tuple:
    """Reactivate a previously unsubscribed email.

    Args:
        email: The subscriber's email address.

    Returns:
        JSON confirmation message.
    """
    from sqlalchemy import select

    from app.models.subscription import Subscription

    subscription = db.session.execute(
        select(Subscription).where(Subscription.email == email)
    ).scalar_one_or_none()

    if subscription is None:
        abort(404, description="Subscription not found")

    message = subscription_service.resubscribe(
        subscription.unsubscribe_token
    )

    return jsonify(success_response(
        SubscriptionMessage(message="Subscription reactivated!").model_dump()
    )), 200
