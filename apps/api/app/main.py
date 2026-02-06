"""
Catastrophe Mapping API - Main Application Entry Point
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import (
    earthquake_parametric,
    earthquakes,
    hurricanes,
    indemnity,
    notifications,
    parametric,
    severe_weather,
    subscriptions,
    wildfires,
)
from app.services.realtime_service import realtime_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: Initialize connections and start real-time monitoring
    logger.info("Starting Catastrophe Mapping API...")
    await realtime_service.start()
    yield
    # Shutdown: Clean up
    await realtime_service.stop()
    logger.info("Shutting down...")


app = FastAPI(
    title="Catastrophe Mapping API",
    description="Real-time earthquake and hurricane tracking API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(earthquakes.router, prefix="/api/earthquakes", tags=["Earthquakes"])
app.include_router(hurricanes.router, prefix="/api/hurricanes", tags=["Hurricanes"])
app.include_router(wildfires.router, prefix="/api/wildfires", tags=["Wildfires"])
app.include_router(severe_weather.router, prefix="/api/severe-weather", tags=["Severe Weather"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["Subscriptions"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(parametric.router, prefix="/api", tags=["Parametric Insurance - Tropical Cyclone"])
app.include_router(earthquake_parametric.router, prefix="/api", tags=["Parametric Insurance - Earthquake"])
app.include_router(indemnity.router, prefix="/api", tags=["Indemnity Insurance"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Catastrophe Mapping API",
        "version": "0.1.0",
    }


@app.get("/api/health")
async def health_check():
    """Detailed health check — verifies DB and external API reachability."""
    import httpx
    from sqlalchemy import text

    from app.core.database import async_session_maker

    health: dict = {"status": "healthy", "database": "unavailable", "external_apis": {}}

    # Check database
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        health["database"] = "connected"
    except Exception as exc:
        health["database"] = f"error: {exc}"
        health["status"] = "degraded"

    # Check USGS
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://earthquake.usgs.gov/fdsnws/event/1/version"
            )
            health["external_apis"]["usgs"] = (
                "available" if resp.status_code == 200 else f"status {resp.status_code}"
            )
    except Exception:
        health["external_apis"]["usgs"] = "unavailable"
        health["status"] = "degraded"

    # Check NOAA
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.head("https://api.weather.gov")
            health["external_apis"]["noaa"] = (
                "available" if resp.status_code < 400 else f"status {resp.status_code}"
            )
    except Exception:
        health["external_apis"]["noaa"] = "unavailable"
        health["status"] = "degraded"

    return health
