"""Tests for the Flask application factory and related registration helpers."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from app import create_app
from app.config import Settings


# Re-use conftest's TestSettings so the factory can be exercised without
# touching env vars or real databases.
from app.tests.conftest import TestSettings


class TestCreateApp:
    """Application factory ``create_app()`` tests."""

    def test_create_app_returns_flask_instance(self, app: Flask) -> None:
        assert isinstance(app, Flask)

    def test_create_app_with_custom_settings(self) -> None:
        custom_app = create_app(config_class=TestSettings)
        assert isinstance(custom_app, Flask)
        assert custom_app.config["SETTINGS"].DEBUG is True

    def test_create_app_default_settings_uses_env(self) -> None:
        """When no config_class is passed a default ``Settings`` is used."""
        with patch.dict("os.environ", {"DEBUG": "true", "API_KEY": "k", "API_KEY_ENABLED": "true"}):
            default_app = create_app()
            assert isinstance(default_app, Flask)

    def test_create_app_sets_secret_key(self, app: Flask) -> None:
        assert app.config["SECRET_KEY"] == "test-secret-key"

    def test_create_app_stores_settings_object(self, app: Flask) -> None:
        settings = app.config.get("SETTINGS")
        assert settings is not None
        assert isinstance(settings, Settings)


class TestBlueprintRegistration:
    """Blueprints should be registered with correct URL prefixes."""

    def test_earthquakes_blueprint_registered(self, app: Flask) -> None:
        assert "earthquakes" in app.blueprints

    def test_hurricanes_blueprint_registered(self, app: Flask) -> None:
        assert "hurricanes" in app.blueprints

    def test_wildfires_blueprint_registered(self, app: Flask) -> None:
        assert "wildfires" in app.blueprints

    def test_severe_weather_blueprint_registered(self, app: Flask) -> None:
        assert "severe_weather" in app.blueprints

    def test_subscriptions_blueprint_registered(self, app: Flask) -> None:
        assert "subscriptions" in app.blueprints

    def test_parametric_blueprint_registered(self, app: Flask) -> None:
        assert "parametric" in app.blueprints

    def test_earthquake_parametric_blueprint_registered(self, app: Flask) -> None:
        assert "earthquake_parametric" in app.blueprints

    def test_indemnity_blueprint_registered(self, app: Flask) -> None:
        assert "indemnity" in app.blueprints

    def test_main_blueprint_registered(self, app: Flask) -> None:
        assert "main" in app.blueprints

    def test_metrics_blueprint_registered(self, app: Flask) -> None:
        assert "metrics" in app.blueprints


class TestErrorHandlerRegistration:
    """Error handlers should return structured JSON for API routes."""

    def test_api_404_returns_json(self, client) -> None:
        response = client.get("/api/v1/this-does-not-exist")
        assert response.status_code == 404
        data = response.get_json()
        assert data is not None
        assert data["errors"][0]["code"] == "NOT_FOUND"

    def test_web_404_returns_html(self, client) -> None:
        response = client.get("/this-page-does-not-exist")
        assert response.status_code == 404
        # Web 404 should NOT return JSON
        assert response.content_type.startswith("text/html")


class TestHealthCheck:
    """Health-check endpoint ``/api/v1/health`` tests."""

    @patch("app.extensions.db")
    def test_health_check_healthy(self, mock_db, client) -> None:
        mock_db.session.execute.return_value = None
        mock_db.text.return_value = "SELECT 1"
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] in ("healthy", "degraded")
        assert "timestamp" in data
        assert "components" in data

    def test_health_check_endpoint_exists(self, app: Flask) -> None:
        rules = [rule.rule for rule in app.url_map.iter_rules()]
        assert "/api/v1/health" in rules


class TestMiddlewareRegistration:
    """Verify that before/after request hooks are active."""

    def test_correlation_id_header_present(self, client) -> None:
        response = client.get("/api/v1/health")
        assert "X-Correlation-ID" in response.headers

    def test_request_duration_header_present(self, client) -> None:
        response = client.get("/api/v1/health")
        assert "X-Request-Duration" in response.headers

    def test_security_headers_present(self, client) -> None:
        response = client.get("/api/v1/health")
        assert "X-Content-Type-Options" in response.headers
        assert "X-Frame-Options" in response.headers


class TestBackgroundMonitor:
    """Background monitor flag should be set on first request."""

    def test_monitor_started_flag(self, app: Flask, client) -> None:
        client.get("/api/v1/health")
        assert app.config.get("_MONITOR_STARTED") is True
