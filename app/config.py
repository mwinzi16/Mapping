"""Application configuration using a dataclass loaded from environment variables."""
from __future__ import annotations

import logging
import os
import secrets
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)


def _csv_list(raw: str, default: List[str] | None = None) -> List[str]:
    """Parse a comma-separated env var into a list of strings.

    Args:
        raw: Raw environment variable value.
        default: Fallback when *raw* is empty.

    Returns:
        A list of trimmed, non-empty strings.
    """
    if not raw:
        return default or []
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass
class Settings:
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = field(
        default_factory=lambda: os.environ.get("APP_NAME", "Catastrophe Mapping API")
    )
    DEBUG: bool = field(
        default_factory=lambda: os.environ.get("DEBUG", "false").lower() in ("1", "true", "yes")
    )

    # Authentication
    API_KEY: str = field(
        default_factory=lambda: os.environ.get("API_KEY", "")
    )
    API_KEY_ENABLED: bool = field(
        default_factory=lambda: os.environ.get("API_KEY_ENABLED", "false").lower()
        in ("1", "true", "yes")
    )

    # Database – default kept for local dev; override via env in production
    DATABASE_URL: str = field(
        default_factory=lambda: os.environ.get(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/catastrophe_db",
        )
    )

    # Redis
    REDIS_URL: str = field(
        default_factory=lambda: os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    )

    # CORS
    CORS_ORIGINS: List[str] = field(
        default_factory=lambda: _csv_list(
            os.environ.get("CORS_ORIGINS", ""),
            default=["http://localhost:5173", "http://localhost:3000"],
        )
    )

    # External APIs
    USGS_API_BASE: str = field(
        default_factory=lambda: os.environ.get(
            "USGS_API_BASE", "https://earthquake.usgs.gov/fdsnws/event/1"
        )
    )
    NOAA_API_BASE: str = field(
        default_factory=lambda: os.environ.get(
            "NOAA_API_BASE", "https://www.nhc.noaa.gov/CurrentStorms.json"
        )
    )
    NASA_FIRMS_API_KEY: Optional[str] = field(
        default_factory=lambda: os.environ.get("NASA_FIRMS_API_KEY")
    )

    # Email settings (for alert subscriptions)
    SMTP_HOST: str = field(
        default_factory=lambda: os.environ.get("SMTP_HOST", "localhost")
    )
    SMTP_PORT: int = field(
        default_factory=lambda: int(os.environ.get("SMTP_PORT", "587"))
    )
    SMTP_USER: Optional[str] = field(
        default_factory=lambda: os.environ.get("SMTP_USER")
    )
    SMTP_PASSWORD: Optional[str] = field(
        default_factory=lambda: os.environ.get("SMTP_PASSWORD")
    )
    FROM_EMAIL: str = field(
        default_factory=lambda: os.environ.get(
            "FROM_EMAIL", "alerts@catastrophe-mapping.com"
        )
    )
    FROM_NAME: str = field(
        default_factory=lambda: os.environ.get(
            "FROM_NAME", "Catastrophe Mapping Alerts"
        )
    )

    # Mapbox (for geocoding if needed)
    MAPBOX_TOKEN: str = field(
        default_factory=lambda: os.environ.get("MAPBOX_TOKEN", "")
    )

    # WebSocket limits
    MAX_WS_CONNECTIONS: int = field(
        default_factory=lambda: int(os.environ.get("MAX_WS_CONNECTIONS", "1000"))
    )

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = field(
        default_factory=lambda: os.environ.get("RATE_LIMIT_DEFAULT", "100/minute")
    )

    # Flask session secret
    SECRET_KEY: str = field(
        default_factory=lambda: os.environ.get(
            "SECRET_KEY", ""
        )
    )

    def __post_init__(self) -> None:
        """Validate critical settings after initialisation."""
        if not self.SECRET_KEY:
            if self.DEBUG:
                self.SECRET_KEY = secrets.token_hex(32)
                logger.warning(
                    "SECRET_KEY not set — generated ephemeral key for dev. "
                    "Set SECRET_KEY env var in production."
                )
            else:
                raise RuntimeError(
                    "SECRET_KEY environment variable is required in production. "
                    "Generate one with: python -c 'import secrets; print(secrets.token_hex(32))'"
                )

        if self.API_KEY_ENABLED and not self.API_KEY:
            raise RuntimeError(
                "API_KEY must be set when API_KEY_ENABLED is true."
            )


# Module-level singleton — import ``settings`` for direct access.
settings = Settings()
