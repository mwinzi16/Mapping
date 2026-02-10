"""Shared test fixtures for the Catastrophe Mapping test suite."""
from __future__ import annotations

import pytest

from app import create_app
from app.config import Settings
from app.extensions import db as _db


class TestSettings(Settings):
    """Test configuration — uses SQLite in-memory, disables external services."""

    DATABASE_URL: str = "sqlite:///:memory:"
    TESTING: bool = True
    DEBUG: bool = True
    API_KEY: str = "test-key-12345"
    API_KEY_ENABLED: bool = True
    SECRET_KEY: str = "test-secret-key"
    REDIS_URL: str = ""
    CORS_ORIGINS: list = None  # type: ignore[assignment]
    RATELIMIT_ENABLED: bool = False

    def __post_init__(self) -> None:
        # Override field defaults that dataclass factories would set.
        object.__setattr__(self, "DATABASE_URL", "sqlite:///:memory:")
        object.__setattr__(self, "TESTING", True)
        object.__setattr__(self, "DEBUG", True)
        object.__setattr__(self, "API_KEY", "test-key-12345")
        object.__setattr__(self, "API_KEY_ENABLED", True)
        object.__setattr__(self, "SECRET_KEY", "test-secret-key")
        object.__setattr__(self, "REDIS_URL", "")
        object.__setattr__(self, "CORS_ORIGINS", ["*"])
        object.__setattr__(self, "RATELIMIT_ENABLED", False)


@pytest.fixture(scope="session")
def app():
    """Create application for testing."""
    _app = create_app(config_class=TestSettings)
    with _app.app_context():
        # Models that use GeoAlchemy2 Geometry columns cannot be created
        # in SQLite.  We rely on mocking for DB-dependent tests instead.
        pass
    yield _app


@pytest.fixture
def client(app):
    """Test client for making requests."""
    return app.test_client()


@pytest.fixture
def api_headers():
    """Headers with valid API key."""
    return {"X-API-Key": "test-key-12345", "Content-Type": "application/json"}


@pytest.fixture
def invalid_api_headers():
    """Headers with an invalid API key."""
    return {"X-API-Key": "wrong-key", "Content-Type": "application/json"}


@pytest.fixture
def no_key_headers():
    """Headers without an API key."""
    return {"Content-Type": "application/json"}
