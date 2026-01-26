"""
Wildfire database model.
"""
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Integer, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry

from app.core.database import Base


class Wildfire(Base):
    """Wildfire event model with PostGIS geometry."""
    
    __tablename__ = "wildfires"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    
    # Fire details
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    geometry = mapped_column(Geometry("POINT", srid=4326))
    
    # Fire metrics
    brightness: Mapped[float] = mapped_column(Float, nullable=True)  # MODIS brightness
    brightness_t31: Mapped[float] = mapped_column(Float, nullable=True)
    frp: Mapped[float] = mapped_column(Float, nullable=True)  # Fire Radiative Power (MW)
    confidence: Mapped[int] = mapped_column(Integer, nullable=True)  # 0-100%
    
    # Area (for larger fires)
    acres_burned: Mapped[float] = mapped_column(Float, nullable=True)
    containment_percent: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # Source info
    satellite: Mapped[str] = mapped_column(String(20), nullable=True)  # MODIS, VIIRS
    source: Mapped[str] = mapped_column(String(50))  # NASA FIRMS, NIFC
    
    # Timing
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
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
        return f"<Wildfire {self.name or self.source_id} ({self.acres_burned or 0} acres)>"
