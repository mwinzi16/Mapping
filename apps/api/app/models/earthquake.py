"""
Earthquake database model.
"""
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry

from app.core.database import Base


class Earthquake(Base):
    """Earthquake event model with PostGIS geometry."""
    
    __tablename__ = "earthquakes"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usgs_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    
    # Event details
    magnitude: Mapped[float] = mapped_column(Float, index=True)
    magnitude_type: Mapped[str] = mapped_column(String(10))  # ml, mb, mw, etc.
    depth_km: Mapped[float] = mapped_column(Float)
    
    # Location
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    location: Mapped[str] = mapped_column(String(255))
    geometry = mapped_column(Geometry("POINT", srid=4326))
    
    # Timing
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    
    # Additional info
    place: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))  # automatic, reviewed
    tsunami: Mapped[int] = mapped_column(Integer, default=0)
    significance: Mapped[int] = mapped_column(Integer)
    
    # Raw data
    raw_data: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Record timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    
    def __repr__(self) -> str:
        return f"<Earthquake M{self.magnitude} @ {self.place}>"
