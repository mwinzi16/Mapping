"""Security and observability middleware."""
from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Add correlation ID to requests for tracing."""

    async def dispatch(self, request: Request, call_next) -> Response:
        correlation_id = request.headers.get(
            "X-Correlation-ID", str(uuid.uuid4())
        )
        request.state.correlation_id = correlation_id
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Request-Duration"] = f"{duration:.3f}s"
        logger.info(
            "request_completed",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": str(request.url.path),
                "status_code": response.status_code,
                "duration_seconds": round(duration, 3),
            },
        )
        return response
