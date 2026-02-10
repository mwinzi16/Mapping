"""Earthquake database model."""
from __future__ import annotations

from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class Earthquake(db.Model):  # type: ignore[name-defined]
    """Earthquake event model with PostGIS geometry."""

    __tablename__ = "earthquakes"
    __table_args__ = (
        Index("idx_earthquake_geometry", "geometry", postgresql_using="gist"),
        Index("idx_earthquake_mag_time", "magnitude", "event_time"),
        Index("idx_earthquake_event_time", "event_time"),
        CheckConstraint("magnitude >= 0", name="ck_earthquake_magnitude_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usgs_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)

    # Event details
    magnitude: Mapped[float] = mapped_column(Float, index=True)
    magnitude_type: Mapped[str] = mapped_column(String(10))  # ml, mb, mw, etc.
    depth_km: Mapped[float] = mapped_column(Float)

    # Location
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    geometry = mapped_column(Geometry("POINT", srid=4326))

    # Timing
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    # Additional info
    place: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))  # automatic, reviewed
    tsunami: Mapped[int] = mapped_column(Integer, default=0)
    significance: Mapped[int] = mapped_column(Integer)

    # Raw data
    raw_data: Mapped[str] = mapped_column(Text, nullable=True)

    # Record timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Earthquake(id={self.id}, M{self.magnitude}, {self.place})>"
