"""Security and observability middleware (Flask before/after request hooks)."""
from __future__ import annotations

import logging
import time
import uuid

from flask import Flask, g, request

logger = logging.getLogger(__name__)


def register_middleware(app: Flask) -> None:
    """Register before_request / after_request hooks on *app*.

    Args:
        app: The Flask application instance.
    """

    @app.before_request
    def set_correlation_id() -> None:
        """Attach a correlation ID and request start time to ``flask.g``."""
        g.correlation_id = request.headers.get(
            "X-Correlation-ID", str(uuid.uuid4())
        )
        g.request_start_time = time.time()

    @app.after_request
    def add_headers(response):
        """Add security, correlation and timing headers to every response."""
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )
        _is_secure = (
            request.is_secure
            or request.headers.get("X-Forwarded-Proto", "") == "https"
        )
        if _is_secure:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Correlation / timing
        correlation_id = getattr(g, "correlation_id", None)
        if correlation_id:
            response.headers["X-Correlation-ID"] = correlation_id

        start_time = getattr(g, "request_start_time", None)
        if start_time is not None:
            duration = time.time() - start_time
            response.headers["X-Request-Duration"] = f"{duration:.3f}s"
            logger.info(
                "request_completed",
                extra={
                    "correlation_id": correlation_id,
                    "method": request.method,
                    "path": request.path,
                    "status_code": response.status_code,
                    "duration_seconds": round(duration, 3),
                },
            )

        return response
