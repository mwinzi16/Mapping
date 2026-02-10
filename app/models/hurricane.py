"""Hurricane database model."""
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


class Hurricane(db.Model):  # type: ignore[name-defined]
    """Hurricane / Tropical Cyclone event model."""

    __tablename__ = "hurricanes"
    __table_args__ = (
        Index("idx_hurricane_geometry", "geometry", postgresql_using="gist"),
        Index("idx_hurricane_track", "track", postgresql_using="gist"),
        Index("idx_hurricane_is_active", "is_active"),
        Index("idx_hurricane_basin_advisory", "basin", "advisory_time"),
        CheckConstraint(
            "category >= 0 AND category <= 5", name="ck_hurricane_category_range"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    storm_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)

    # Storm identification
    name: Mapped[str] = mapped_column(String(100), index=True)
    basin: Mapped[str] = mapped_column(String(20))  # AL, EP, WP, etc.

    # Classification
    classification: Mapped[str] = mapped_column(String(50))  # Tropical Storm, Hurricane, etc.
    category: Mapped[int] = mapped_column(Integer, nullable=True)  # Saffir-Simpson 1-5

    # Current position
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    geometry = mapped_column(Geometry("POINT", srid=4326))

    # Track (as LineString for historical path)
    track = mapped_column(Geometry("LINESTRING", srid=4326), nullable=True)

    # Intensity
    max_wind_mph: Mapped[int] = mapped_column(Integer)
    max_wind_knots: Mapped[int] = mapped_column(Integer)
    min_pressure_mb: Mapped[int] = mapped_column(Integer, nullable=True)

    # Movement
    movement_direction: Mapped[str] = mapped_column(String(20), nullable=True)
    movement_speed_mph: Mapped[int] = mapped_column(Integer, nullable=True)

    # Timing
    advisory_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True
    )

    # Status
    is_active: Mapped[bool] = mapped_column(default=True)

    # Raw data
    raw_data: Mapped[str] = mapped_column(Text, nullable=True)

    # Record timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Hurricane(id={self.id}, {self.name}, Cat{self.category})>"
