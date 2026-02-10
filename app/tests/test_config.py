"""Tests for application configuration (Settings dataclass)."""
from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from app.config import Settings, _csv_list


# =========================================================================
# _csv_list helper
# =========================================================================

class TestCsvList:
    """Tests for the ``_csv_list`` parsing helper."""

    def test_csv_list_empty_returns_default(self) -> None:
        assert _csv_list("", default=["a"]) == ["a"]

    def test_csv_list_empty_no_default(self) -> None:
        assert _csv_list("") == []

    def test_csv_list_single(self) -> None:
        assert _csv_list("http://localhost") == ["http://localhost"]

    def test_csv_list_multiple(self) -> None:
        result = _csv_list("a,b,c")
        assert result == ["a", "b", "c"]

    def test_csv_list_trims_whitespace(self) -> None:
        result = _csv_list("  a , b , c  ")
        assert result == ["a", "b", "c"]

    def test_csv_list_strips_empty_items(self) -> None:
        result = _csv_list("a,,b,")
        assert result == ["a", "b"]


# =========================================================================
# Settings defaults
# =========================================================================

class TestSettingsDefaults:
    """Verify Settings defaults when env vars are absent."""

    @patch.dict(os.environ, {}, clear=True)
    def test_default_app_name(self) -> None:
        s = Settings()
        assert s.APP_NAME == "Catastrophe Mapping API"

    @patch.dict(os.environ, {}, clear=True)
    def test_default_debug_false(self) -> None:
        s = Settings()
        assert s.DEBUG is False

    @patch.dict(os.environ, {}, clear=True)
    def test_default_api_key_empty(self) -> None:
        s = Settings()
        assert s.API_KEY == ""

    @patch.dict(os.environ, {}, clear=True)
    def test_default_api_key_enabled_false(self) -> None:
        s = Settings()
        assert s.API_KEY_ENABLED is False

    @patch.dict(os.environ, {}, clear=True)
    def test_default_database_url(self) -> None:
        s = Settings()
        assert "postgresql" in s.DATABASE_URL

    @patch.dict(os.environ, {}, clear=True)
    def test_default_redis_url(self) -> None:
        s = Settings()
        assert s.REDIS_URL.startswith("redis://")

    @patch.dict(os.environ, {}, clear=True)
    def test_default_cors_origins(self) -> None:
        s = Settings()
        assert isinstance(s.CORS_ORIGINS, list)
        assert len(s.CORS_ORIGINS) >= 1

    @patch.dict(os.environ, {}, clear=True)
    def test_default_smtp_host(self) -> None:
        s = Settings()
        assert s.SMTP_HOST == "localhost"

    @patch.dict(os.environ, {}, clear=True)
    def test_default_smtp_port(self) -> None:
        s = Settings()
        assert s.SMTP_PORT == 587

    @patch.dict(os.environ, {}, clear=True)
    def test_default_mapbox_token_empty(self) -> None:
        s = Settings()
        assert s.MAPBOX_TOKEN == ""

    @patch.dict(os.environ, {}, clear=True)
    def test_default_max_ws_connections(self) -> None:
        s = Settings()
        assert s.MAX_WS_CONNECTIONS == 1000

    @patch.dict(os.environ, {}, clear=True)
    def test_default_rate_limit(self) -> None:
        s = Settings()
        assert s.RATE_LIMIT_DEFAULT == "100/minute"

    @patch.dict(os.environ, {}, clear=True)
    def test_default_secret_key(self) -> None:
        s = Settings()
        assert s.SECRET_KEY == "change-me-in-production"

    @patch.dict(os.environ, {}, clear=True)
    def test_default_nasa_firms_key_none(self) -> None:
        s = Settings()
        assert s.NASA_FIRMS_API_KEY is None

    @patch.dict(os.environ, {}, clear=True)
    def test_default_smtp_user_none(self) -> None:
        s = Settings()
        assert s.SMTP_USER is None

    @patch.dict(os.environ, {}, clear=True)
    def test_default_smtp_password_none(self) -> None:
        s = Settings()
        assert s.SMTP_PASSWORD is None


# =========================================================================
# Settings from env vars
# =========================================================================

class TestSettingsFromEnv:
    """Verify Settings reads from environment variables correctly."""

    @patch.dict(os.environ, {"APP_NAME": "My App"})
    def test_env_app_name(self) -> None:
        s = Settings()
        assert s.APP_NAME == "My App"

    @patch.dict(os.environ, {"DEBUG": "true"})
    def test_env_debug_true(self) -> None:
        s = Settings()
        assert s.DEBUG is True

    @patch.dict(os.environ, {"DEBUG": "1"})
    def test_env_debug_one(self) -> None:
        s = Settings()
        assert s.DEBUG is True

    @patch.dict(os.environ, {"DEBUG": "yes"})
    def test_env_debug_yes(self) -> None:
        s = Settings()
        assert s.DEBUG is True

    @patch.dict(os.environ, {"DEBUG": "no"})
    def test_env_debug_no(self) -> None:
        s = Settings()
        assert s.DEBUG is False

    @patch.dict(os.environ, {"API_KEY": "secret123"})
    def test_env_api_key(self) -> None:
        s = Settings()
        assert s.API_KEY == "secret123"

    @patch.dict(os.environ, {"API_KEY_ENABLED": "true"})
    def test_env_api_key_enabled(self) -> None:
        s = Settings()
        assert s.API_KEY_ENABLED is True

    @patch.dict(os.environ, {"DATABASE_URL": "postgresql://user:pass@db:5432/mydb"})
    def test_env_database_url(self) -> None:
        s = Settings()
        assert s.DATABASE_URL == "postgresql://user:pass@db:5432/mydb"

    @patch.dict(os.environ, {"REDIS_URL": "redis://cache:6379/1"})
    def test_env_redis_url(self) -> None:
        s = Settings()
        assert s.REDIS_URL == "redis://cache:6379/1"

    @patch.dict(os.environ, {"CORS_ORIGINS": "https://example.com,https://other.com"})
    def test_env_cors_origins(self) -> None:
        s = Settings()
        assert s.CORS_ORIGINS == ["https://example.com", "https://other.com"]

    @patch.dict(os.environ, {"SECRET_KEY": "production-key"})
    def test_env_secret_key(self) -> None:
        s = Settings()
        assert s.SECRET_KEY == "production-key"

    @patch.dict(os.environ, {"SMTP_PORT": "465"})
    def test_env_smtp_port(self) -> None:
        s = Settings()
        assert s.SMTP_PORT == 465

    @patch.dict(os.environ, {"MAX_WS_CONNECTIONS": "500"})
    def test_env_max_ws_connections(self) -> None:
        s = Settings()
        assert s.MAX_WS_CONNECTIONS == 500

    @patch.dict(os.environ, {"RATE_LIMIT_DEFAULT": "50/minute"})
    def test_env_rate_limit_default(self) -> None:
        s = Settings()
        assert s.RATE_LIMIT_DEFAULT == "50/minute"

    @patch.dict(os.environ, {"NASA_FIRMS_API_KEY": "firms-key"})
    def test_env_nasa_firms_api_key(self) -> None:
        s = Settings()
        assert s.NASA_FIRMS_API_KEY == "firms-key"

    @patch.dict(os.environ, {"MAPBOX_TOKEN": "pk.abc123"})
    def test_env_mapbox_token(self) -> None:
        s = Settings()
        assert s.MAPBOX_TOKEN == "pk.abc123"

    @patch.dict(os.environ, {"FROM_EMAIL": "hi@test.com"})
    def test_env_from_email(self) -> None:
        s = Settings()
        assert s.FROM_EMAIL == "hi@test.com"

    @patch.dict(os.environ, {"FROM_NAME": "Test Alerts"})
    def test_env_from_name(self) -> None:
        s = Settings()
        assert s.FROM_NAME == "Test Alerts"


# =========================================================================
# Module-level singleton
# =========================================================================

class TestSettingsSingleton:
    """Module-level ``settings`` object should be importable."""

    def test_module_settings_is_instance(self) -> None:
        from app.config import settings

        assert isinstance(settings, Settings)
