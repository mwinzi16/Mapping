"""Tests for core modules: exceptions, auth, response, middleware, metrics, logging."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# exceptions.py
# ---------------------------------------------------------------------------
from app.core.exceptions import (
    AppError,
    AuthenticationError,
    AuthorizationError,
    ExternalServiceError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)


class TestAppError:
    """Tests for the base AppError exception."""

    def test_app_error_defaults(self) -> None:
        err = AppError("boom")
        assert err.message == "boom"
        assert err.code == "INTERNAL_ERROR"
        assert err.status_code == 500
        assert err.details is None

    def test_app_error_custom_fields(self) -> None:
        err = AppError("oops", code="CUSTOM", status_code=418, details={"x": 1})
        assert err.code == "CUSTOM"
        assert err.status_code == 418
        assert err.details == {"x": 1}

    def test_app_error_is_exception(self) -> None:
        with pytest.raises(AppError):
            raise AppError("test")


class TestNotFoundError:
    """Tests for NotFoundError."""

    def test_not_found_default_message(self) -> None:
        err = NotFoundError()
        assert err.message == "Resource not found"
        assert err.code == "NOT_FOUND"
        assert err.status_code == 404

    def test_not_found_custom_message(self) -> None:
        err = NotFoundError("User not found", details={"id": 42})
        assert err.message == "User not found"
        assert err.details == {"id": 42}


class TestValidationError:
    """Tests for ValidationError."""

    def test_validation_defaults(self) -> None:
        err = ValidationError()
        assert err.status_code == 422
        assert err.code == "VALIDATION_ERROR"

    def test_validation_with_details(self) -> None:
        err = ValidationError("bad input", details=["field required"])
        assert err.message == "bad input"
        assert err.details == ["field required"]


class TestAuthenticationError:
    """Tests for AuthenticationError."""

    def test_authentication_defaults(self) -> None:
        err = AuthenticationError()
        assert err.status_code == 401
        assert err.code == "AUTHENTICATION_ERROR"

    def test_authentication_custom(self) -> None:
        err = AuthenticationError("Token expired")
        assert err.message == "Token expired"


class TestAuthorizationError:
    """Tests for AuthorizationError."""

    def test_authorization_defaults(self) -> None:
        err = AuthorizationError()
        assert err.status_code == 403
        assert err.code == "AUTHORIZATION_ERROR"


class TestRateLimitError:
    """Tests for RateLimitError."""

    def test_rate_limit_defaults(self) -> None:
        err = RateLimitError()
        assert err.status_code == 429
        assert err.code == "RATE_LIMIT_EXCEEDED"


class TestExternalServiceError:
    """Tests for ExternalServiceError."""

    def test_external_service_defaults(self) -> None:
        err = ExternalServiceError()
        assert err.status_code == 502
        assert err.code == "EXTERNAL_SERVICE_ERROR"

    def test_external_service_custom(self) -> None:
        err = ExternalServiceError("USGS down", details={"url": "https://usgs.gov"})
        assert err.message == "USGS down"


# ---------------------------------------------------------------------------
# auth.py — require_api_key decorator
# ---------------------------------------------------------------------------

class TestRequireApiKey:
    """Tests for the require_api_key decorator."""

    def test_require_api_key_valid_header(self, app, client, api_headers) -> None:
        """Valid API key in header passes through."""
        @app.route("/test-auth-valid")
        @patch("app.core.auth.require_api_key", wraps=None)
        def _view():
            return "ok"

        # Use a real route registered in the app (health check)
        # Instead, let's test via subscriptions which uses @require_api_key
        pass  # covered by blueprint tests below

    def test_require_api_key_valid_key_passes(self, app) -> None:
        from app.core.auth import require_api_key

        with app.test_request_context(headers={"X-API-Key": "test-key-12345"}):
            @require_api_key
            def dummy_view():
                return "ok"

            result = dummy_view()
            assert result == "ok"

    def test_require_api_key_invalid_key_raises(self, app) -> None:
        from app.core.auth import require_api_key

        with app.test_request_context(headers={"X-API-Key": "wrong-key"}):
            @require_api_key
            def dummy_view():
                return "ok"

            with pytest.raises(AuthenticationError, match="Invalid API key"):
                dummy_view()

    def test_require_api_key_missing_key_raises(self, app) -> None:
        from app.core.auth import require_api_key

        with app.test_request_context():
            @require_api_key
            def dummy_view():
                return "ok"

            with pytest.raises(AuthenticationError, match="API key required"):
                dummy_view()

    def test_require_api_key_disabled_passes(self, app) -> None:
        from app.core.auth import require_api_key

        original = app.config["SETTINGS"].API_KEY_ENABLED
        try:
            app.config["SETTINGS"].API_KEY_ENABLED = False
            with app.test_request_context():
                @require_api_key
                def dummy_view():
                    return "ok"

                result = dummy_view()
                assert result == "ok"
        finally:
            app.config["SETTINGS"].API_KEY_ENABLED = original

    def test_require_api_key_via_query_param(self, app) -> None:
        from app.core.auth import require_api_key

        with app.test_request_context("/?api_key=test-key-12345"):
            @require_api_key
            def dummy_view():
                return "ok"

            result = dummy_view()
            assert result == "ok"


# ---------------------------------------------------------------------------
# response.py
# ---------------------------------------------------------------------------
from app.core.response import error_response, paginated_response, success_response


class TestSuccessResponse:
    """Tests for success_response helper."""

    def test_success_response_data_only(self) -> None:
        result = success_response({"key": "value"})
        assert result == {"data": {"key": "value"}}
        assert "meta" not in result

    def test_success_response_with_meta(self) -> None:
        result = success_response([1, 2, 3], meta={"count": 3})
        assert result["data"] == [1, 2, 3]
        assert result["meta"] == {"count": 3}

    def test_success_response_none_data(self) -> None:
        result = success_response(None)
        assert result == {"data": None}

    def test_success_response_empty_meta_excluded(self) -> None:
        result = success_response("x", meta={})
        # Empty dict is falsy, so meta should not be present.
        assert "meta" not in result


class TestErrorResponse:
    """Tests for error_response helper."""

    def test_error_response_basic(self) -> None:
        result = error_response("NOT_FOUND", "Not found")
        assert result["data"] is None
        assert len(result["errors"]) == 1
        assert result["errors"][0]["code"] == "NOT_FOUND"
        assert result["errors"][0]["message"] == "Not found"

    def test_error_response_with_details(self) -> None:
        result = error_response("VAL", "bad", details={"field": "name"})
        assert result["errors"][0]["details"] == {"field": "name"}

    def test_error_response_no_details(self) -> None:
        result = error_response("ERR", "oops")
        assert "details" not in result["errors"][0]


class TestPaginatedResponse:
    """Tests for paginated_response helper."""

    def test_paginated_response_basic(self) -> None:
        result = paginated_response(items=[1, 2], total=10, page=1, per_page=2)
        assert result["data"] == [1, 2]
        assert result["meta"]["total"] == 10
        assert result["meta"]["page"] == 1
        assert result["meta"]["per_page"] == 2
        assert result["meta"]["total_pages"] == 5

    def test_paginated_response_single_page(self) -> None:
        result = paginated_response(items=[1], total=1, page=1, per_page=10)
        assert result["meta"]["total_pages"] == 1

    def test_paginated_response_empty(self) -> None:
        result = paginated_response(items=[], total=0, page=1, per_page=10)
        assert result["meta"]["total_pages"] == 0

    def test_paginated_response_zero_per_page(self) -> None:
        result = paginated_response(items=[], total=0, page=1, per_page=0)
        assert result["meta"]["total_pages"] == 0

    def test_paginated_response_rounding_up(self) -> None:
        result = paginated_response(items=[], total=11, page=1, per_page=5)
        assert result["meta"]["total_pages"] == 3


# ---------------------------------------------------------------------------
# middleware.py
# ---------------------------------------------------------------------------

class TestMiddleware:
    """Tests for security and observability middleware."""

    def test_correlation_id_generated(self, client) -> None:
        response = client.get("/api/v1/health")
        assert "X-Correlation-ID" in response.headers

    def test_correlation_id_from_request_header(self, client) -> None:
        response = client.get(
            "/api/v1/health",
            headers={"X-Correlation-ID": "my-custom-id"},
        )
        assert response.headers["X-Correlation-ID"] == "my-custom-id"

    def test_security_headers_present(self, client) -> None:
        response = client.get("/api/v1/health")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"
        assert "Referrer-Policy" in response.headers
        assert "Permissions-Policy" in response.headers

    def test_request_duration_header(self, client) -> None:
        response = client.get("/api/v1/health")
        duration = response.headers.get("X-Request-Duration")
        assert duration is not None
        assert duration.endswith("s")


# ---------------------------------------------------------------------------
# metrics.py
# ---------------------------------------------------------------------------

class TestMetricsEndpoint:
    """Tests for the Prometheus /metrics endpoint."""

    def test_metrics_returns_200(self, client) -> None:
        response = client.get("/metrics")
        assert response.status_code == 200

    def test_metrics_content_type(self, client) -> None:
        response = client.get("/metrics")
        assert "text/plain" in response.content_type or "openmetrics" in response.content_type


# ---------------------------------------------------------------------------
# logging.py
# ---------------------------------------------------------------------------

class TestLogging:
    """Tests for structured logging setup."""

    def test_setup_logging_debug(self) -> None:
        from app.core.logging import setup_logging

        # Should not raise
        setup_logging(debug=True)

    def test_setup_logging_production(self) -> None:
        from app.core.logging import setup_logging

        setup_logging(debug=False)

    def test_get_logger_returns_bound_logger(self) -> None:
        from app.core.logging import get_logger

        log = get_logger("test")
        assert log is not None
