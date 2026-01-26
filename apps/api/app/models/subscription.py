"""
Subscription model for email alerts.
"""
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Integer, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Subscription(Base):
    """Email subscription for catastrophe alerts."""
    
    __tablename__ = "subscriptions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    
    # Verification
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_token: Mapped[str] = mapped_column(String(100), nullable=True)
    
    # Alert preferences
    alert_earthquakes: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_hurricanes: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_wildfires: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_tornadoes: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_flooding: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_hail: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Thresholds
    min_earthquake_magnitude: Mapped[float] = mapped_column(Float, default=5.0)
    min_hurricane_category: Mapped[int] = mapped_column(Integer, default=1)
    
    # Geographic filter (optional)
    # Store as JSON: {"lat": 40.7, "lon": -74.0, "radius_km": 500}
    location_filter: Mapped[dict] = mapped_column(JSON, nullable=True)
    
    # Frequency control
    max_emails_per_day: Mapped[int] = mapped_column(Integer, default=10)
    emails_sent_today: Mapped[int] = mapped_column(Integer, default=0)
    last_email_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    unsubscribe_token: Mapped[str] = mapped_column(String(100), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    def __repr__(self) -> str:
        return f"<Subscription {self.email}>"
