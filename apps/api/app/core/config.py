"""
Application configuration using Pydantic Settings.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "Catastrophe Mapping API"
    DEBUG: bool = False

    # Authentication
    API_KEY: str = ""  # Empty = auth disabled for dev convenience
    API_KEY_ENABLED: bool = False

    # Database – default kept for local dev; override via env in production
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/catastrophe_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # External APIs
    USGS_API_BASE: str = "https://earthquake.usgs.gov/fdsnws/event/1"
    NOAA_API_BASE: str = "https://www.nhc.noaa.gov/CurrentStorms.json"
    NASA_FIRMS_API_KEY: Optional[str] = None  # Optional, for higher rate limits

    # Email settings (for alert subscriptions)
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[SecretStr] = None
    FROM_EMAIL: str = "alerts@catastrophe-mapping.com"
    FROM_NAME: str = "Catastrophe Mapping Alerts"

    # Mapbox (for geocoding if needed)
    MAPBOX_TOKEN: str = ""

    # WebSocket limits
    MAX_WS_CONNECTIONS: int = 1000

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = "100/minute"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
