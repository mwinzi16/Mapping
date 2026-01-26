"""
Hurricane database model.
"""
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry

from app.core.database import Base


class Hurricane(Base):
    """Hurricane/Tropical Cyclone event model."""
    
    __tablename__ = "hurricanes"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    storm_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    
    # Storm identification
    name: Mapped[str] = mapped_column(String(100), index=True)
    basin: Mapped[str] = mapped_column(String(20))  # AL (Atlantic), EP (East Pacific), etc.
    
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
    advisory_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(default=True)
    
    # Raw data
    raw_data: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Record timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    def __repr__(self) -> str:
        return f"<Hurricane {self.name} (Cat {self.category})>"
