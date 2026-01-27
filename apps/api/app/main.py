"""
Catastrophe Mapping API - Main Application Entry Point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import earthquakes, hurricanes, notifications, wildfires, severe_weather, subscriptions, parametric, earthquake_parametric, indemnity
from app.core.config import settings
from app.services.realtime_service import realtime_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: Initialize connections and start real-time monitoring
    print("🚀 Starting Catastrophe Mapping API...")
    await realtime_service.start()
    yield
    # Shutdown: Clean up
    await realtime_service.stop()
    print("👋 Shutting down...")


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
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "external_apis": {
            "usgs": "available",
            "noaa": "available",
        },
    }
