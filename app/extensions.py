"""Flask extension initialization."""
from __future__ import annotations

from flask import Flask
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from flask_talisman import Talisman

db = SQLAlchemy()
migrate = Migrate()
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
cors = CORS()
talisman = Talisman()
socketio = SocketIO()


def init_extensions(app: Flask) -> None:
    """Initialize all Flask extensions.

    Args:
        app: The Flask application instance.
    """
    settings = app.config["SETTINGS"]

    # Database -----------------------------------------------------------
    app.config["SQLALCHEMY_DATABASE_URI"] = settings.DATABASE_URL
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30,
        "pool_recycle": 1800,
        "pool_pre_ping": True,
    }
    db.init_app(app)

    # Migrations ---------------------------------------------------------
    migrate.init_app(app, db)

    # CORS ---------------------------------------------------------------
    cors.init_app(
        app,
        origins=settings.CORS_ORIGINS,
        supports_credentials=True,
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-API-Key",
            "X-Correlation-ID",
        ],
    )

    # Rate limiting ------------------------------------------------------
    limiter.init_app(app)

    # Security headers (relaxed CSP for maps) ----------------------------
    _is_debug = settings.DEBUG
    talisman.init_app(
        app,
        force_https=not _is_debug,
        content_security_policy={
            "default-src": "'self'",
            "script-src": [
                "'self'",
                "'unsafe-inline'",
                "https://api.mapbox.com",
                "https://cdn.jsdelivr.net",
            ],
            "style-src": [
                "'self'",
                "'unsafe-inline'",
                "https://api.mapbox.com",
                "https://cdn.jsdelivr.net",
            ],
            "img-src": ["'self'", "data:", "https://*.mapbox.com", "blob:"],
            "connect-src": [
                "'self'",
                "https://api.mapbox.com",
                "https://events.mapbox.com",
                "wss:",
                "ws:" if _is_debug else "",
            ],
            "worker-src": ["'self'", "blob:"],
            "child-src": ["blob:"],
            "frame-ancestors": "'none'",
        },
        session_cookie_secure=not _is_debug,
        session_cookie_httponly=True,
        session_cookie_samesite="Lax",
    )

    # Flask-SocketIO for real-time notifications -------------------------
    socketio.init_app(
        app,
        cors_allowed_origins=settings.CORS_ORIGINS,
        async_mode="threading",
        max_http_buffer_size=1_000_000,
    )
