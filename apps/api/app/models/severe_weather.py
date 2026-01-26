"""
Severe Weather database models (Tornado, Hail, Flooding).
"""
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Integer, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry
import enum

from app.core.database import Base


class SevereWeatherType(str, enum.Enum):
    TORNADO = "tornado"
    HAIL = "hail"
    FLOODING = "flooding"
    WIND = "wind"
    THUNDERSTORM = "thunderstorm"


class SevereWeather(Base):
    """Severe weather event model (tornadoes, hail, flooding, etc.)."""
    
    __tablename__ = "severe_weather"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    
    # Event type
    event_type: Mapped[SevereWeatherType] = mapped_column(
        Enum(SevereWeatherType), index=True
    )
    
    # Location
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    geometry = mapped_column(Geometry("POINT", srid=4326))
    location: Mapped[str] = mapped_column(String(255), nullable=True)
    state: Mapped[str] = mapped_column(String(50), nullable=True)
    county: Mapped[str] = mapped_column(String(100), nullable=True)
    
    # Tornado-specific
    tornado_scale: Mapped[int] = mapped_column(Integer, nullable=True)  # EF0-EF5
    tornado_width_yards: Mapped[int] = mapped_column(Integer, nullable=True)
    tornado_length_miles: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Hail-specific
    hail_size_inches: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Flooding-specific
    flood_severity: Mapped[str] = mapped_column(String(20), nullable=True)  # minor, moderate, major
    river_name: Mapped[str] = mapped_column(String(100), nullable=True)
    flood_stage_ft: Mapped[float] = mapped_column(Float, nullable=True)
    observed_stage_ft: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Wind-specific
    wind_speed_mph: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # General info
    description: Mapped[str] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(50))  # NWS, SPC
    
    # Timing
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Raw data
    raw_data: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Record timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    
    def __repr__(self) -> str:
        return f"<SevereWeather {self.event_type.value} @ {self.location}>"
