"""
Catastrophe Mapping API - Main Application Entry Point
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.logging import setup_logging
from app.core.metrics import metrics_endpoint
from app.core.rate_limit import limiter
from app.core.response import error_response
from app.core.middleware import CorrelationIdMiddleware, SecurityHeadersMiddleware
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
    # Startup: Configure structured logging and start real-time monitoring
    setup_logging(settings.DEBUG)
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

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# Middleware (applied in reverse order — last added runs first)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Correlation-ID"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CorrelationIdMiddleware)

# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handle custom application errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(exc.code, exc.message, exc.details),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handle request validation errors without leaking internals."""
    return JSONResponse(
        status_code=422,
        content=error_response("VALIDATION_ERROR", "Request validation failed", exc.errors()),
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler — never expose stack traces."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=error_response("INTERNAL_ERROR", "An unexpected error occurred"),
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(earthquakes.router, prefix="/api/v1/earthquakes", tags=["Earthquakes"])
app.include_router(hurricanes.router, prefix="/api/v1/hurricanes", tags=["Hurricanes"])
app.include_router(wildfires.router, prefix="/api/v1/wildfires", tags=["Wildfires"])
app.include_router(severe_weather.router, prefix="/api/v1/severe-weather", tags=["Severe Weather"])
app.include_router(subscriptions.router, prefix="/api/v1/subscriptions", tags=["Subscriptions"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(parametric.router, prefix="/api/v1", tags=["Parametric Insurance - Tropical Cyclone"])
app.include_router(earthquake_parametric.router, prefix="/api/v1", tags=["Parametric Insurance - Earthquake"])
app.include_router(indemnity.router, prefix="/api/v1", tags=["Indemnity Insurance"])

# ---------------------------------------------------------------------------
# Prometheus metrics
# ---------------------------------------------------------------------------
app.add_route("/metrics", metrics_endpoint)


# ---------------------------------------------------------------------------
# Root / health endpoints
# ---------------------------------------------------------------------------


@app.get("/")
async def root():
    """Root health check endpoint."""
    return {
        "status": "healthy",
        "service": "Catastrophe Mapping API",
        "version": "0.1.0",
    }


@app.get("/api/health")
async def health_redirect():
    """Redirect legacy health endpoint to versioned endpoint."""
    return RedirectResponse(url="/api/v1/health", status_code=307)


@app.get("/api/v1/health")
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
    except Exception:
        logger.exception("Health check: database unavailable")
        health["database"] = "unavailable"
        health["status"] = "degraded"

    # Check USGS
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://earthquake.usgs.gov/fdsnws/event/1/version"
            )
            health["external_apis"]["usgs"] = (
                "available" if resp.status_code == 200 else "unavailable"
            )
    except Exception:
        health["external_apis"]["usgs"] = "unavailable"
        health["status"] = "degraded"

    # Check NOAA
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.head("https://api.weather.gov")
            health["external_apis"]["noaa"] = (
                "available" if resp.status_code < 400 else "unavailable"
            )
    except Exception:
        health["external_apis"]["noaa"] = "unavailable"
        health["status"] = "degraded"

    return health
