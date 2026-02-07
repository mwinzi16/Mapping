"""Singleton HTTP client management."""
from __future__ import annotations

from functools import lru_cache

from app.services.nasa_firms_client import NASAFirmsClient
from app.services.noaa_client import NOAAClient
from app.services.nws_client import NWSClient
from app.services.usgs_client import USGSClient


@lru_cache()
def get_usgs_client() -> USGSClient:
    """Return the singleton USGSClient instance."""
    return USGSClient()


@lru_cache()
def get_noaa_client() -> NOAAClient:
    """Return the singleton NOAAClient instance."""
    return NOAAClient()


@lru_cache()
def get_firms_client() -> NASAFirmsClient:
    """Return the singleton NASAFirmsClient instance."""
    return NASAFirmsClient()


@lru_cache()
def get_nws_client() -> NWSClient:
    """Return the singleton NWSClient instance."""
    return NWSClient()
