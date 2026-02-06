"""
Pydantic schemas for Subscription API.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class LocationFilter(BaseModel):
    """Geographic filter for alerts."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(500, ge=10, le=5000)


class SubscriptionCreate(BaseModel):
    """Schema for creating a subscription."""
    email: EmailStr
    
    # Event preferences
    alert_earthquakes: bool = True
    alert_hurricanes: bool = True
    alert_wildfires: bool = True
    alert_tornadoes: bool = True
    alert_flooding: bool = True
    alert_hail: bool = True
    
    # Thresholds
    min_earthquake_magnitude: float = Field(5.0, ge=0, le=10)
    min_hurricane_category: int = Field(1, ge=0, le=5)
    
    # Optional location filter
    location_filter: Optional[LocationFilter] = None
    
    # Frequency
    max_emails_per_day: int = Field(10, ge=1, le=50)


class SubscriptionUpdate(BaseModel):
    """Schema for updating subscription preferences."""
    alert_earthquakes: Optional[bool] = None
    alert_hurricanes: Optional[bool] = None
    alert_wildfires: Optional[bool] = None
    alert_tornadoes: Optional[bool] = None
    alert_flooding: Optional[bool] = None
    alert_hail: Optional[bool] = None
    min_earthquake_magnitude: Optional[float] = Field(None, ge=0, le=10)
    min_hurricane_category: Optional[int] = Field(None, ge=0, le=5)
    location_filter: Optional[LocationFilter] = None
    max_emails_per_day: Optional[int] = Field(None, ge=1, le=50)


class SubscriptionResponse(BaseModel):
    """Schema for subscription API responses."""
    id: int
    email: str
    is_verified: bool
    is_active: bool
    
    alert_earthquakes: bool
    alert_hurricanes: bool
    alert_wildfires: bool
    alert_tornadoes: bool
    alert_flooding: bool
    alert_hail: bool
    
    min_earthquake_magnitude: float
    min_hurricane_category: int
    location_filter: Optional[dict]
    max_emails_per_day: int
    
    created_at: datetime
    
    class Config:
        from_attributes = True


class SubscriptionMessage(BaseModel):
    """Simple message response."""
    message: str
    success: bool = True
