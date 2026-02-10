"""Database session helpers for the Flask application.

Flask-SQLAlchemy manages the session lifecycle automatically.  This
module exposes a thin compatibility layer so that service code written
for standalone SQLAlchemy can work unchanged.
"""
from __future__ import annotations

from flask_sqlalchemy.model import Model

from app.extensions import db

# Re-export ``db.Model`` as ``Base`` for code that expects the
# standalone SQLAlchemy ``DeclarativeBase`` entry-point.
Base: type[Model] = db.Model  # type: ignore[assignment]


def get_db() -> db.session:  # type: ignore[name-defined]
    """Return the current Flask-SQLAlchemy scoped session.

    Flask-SQLAlchemy already binds a session to the application
    context, so callers can use this directly within a request or
    an ``app.app_context()`` block.

    Returns:
        The active ``db.session`` proxy.
    """
    return db.session