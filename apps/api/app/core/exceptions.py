"""Custom exception hierarchy for the Catastrophe Mapping API."""
from __future__ import annotations

from typing import Any, Optional


class AppError(Exception):
    """Base application error."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[Any] = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(
        self,
        message: str = "Resource not found",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message, code="NOT_FOUND", status_code=404, details=details
        )


class ValidationError(AppError):
    def __init__(
        self,
        message: str = "Validation failed",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=422,
            details=details,
        )


class AuthenticationError(AppError):
    def __init__(
        self,
        message: str = "Authentication required",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="AUTHENTICATION_ERROR",
            status_code=401,
            details=details,
        )


class AuthorizationError(AppError):
    def __init__(
        self,
        message: str = "Insufficient permissions",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="AUTHORIZATION_ERROR",
            status_code=403,
            details=details,
        )


class RateLimitError(AppError):
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details=details,
        )


class ExternalServiceError(AppError):
    def __init__(
        self,
        message: str = "External service unavailable",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="EXTERNAL_SERVICE_ERROR",
            status_code=502,
            details=details,
        )
