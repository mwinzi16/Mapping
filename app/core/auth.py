"""API key authentication decorator for the Catastrophe Mapping API."""
from __future__ import annotations

import secrets
from functools import wraps
from typing import Any, Callable

from flask import current_app, request

from app.core.exceptions import AuthenticationError


def require_api_key(f: Callable[..., Any]) -> Callable[..., Any]:
    """Decorator requiring a valid API key.

    The key may be supplied via the ``X-API-Key`` header or the
    ``api_key`` query parameter.  When ``API_KEY_ENABLED`` is
    ``False`` in settings the check is skipped entirely.

    Args:
        f: The view function to protect.

    Returns:
        Wrapped view function.
    """

    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        settings = current_app.config["SETTINGS"]
        if not settings.API_KEY_ENABLED:
            return f(*args, **kwargs)
        api_key = request.headers.get("X-API-Key", "")
        if not api_key:
            raise AuthenticationError(
                "API key required. Provide via X-API-Key header."
            )
        if not secrets.compare_digest(api_key, settings.API_KEY):
            raise AuthenticationError("Invalid API key")
        return f(*args, **kwargs)

    return decorated
