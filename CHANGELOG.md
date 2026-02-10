# Changelog

All notable changes to the Catastrophe Analysis Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-01-15

### Added

#### Architecture
- Complete rewrite from FastAPI to Flask 3.1 using the Application Factory pattern
- Blueprint-based route organization with versioned API prefixes (`/api/v1/`)
- Settings dataclass loaded from environment variables (`app/config.py`)
- Extension initialization module (`app/extensions.py`) for SQLAlchemy, Migrate, CORS, Limiter, Talisman, and SocketIO
- Custom exception hierarchy rooted at `AppError` with central error handlers
- Standard JSON response envelope (`success_response`, `error_response`, `paginated_response`)
- Correlation ID middleware for request tracing (`X-Correlation-ID`)
- Security headers middleware (HSTS, X-Content-Type-Options, X-Frame-Options, CSP)
- API key authentication decorator with header and query parameter support

#### Real-Time Monitoring
- Earthquake monitoring via USGS Earthquake Hazards Program API
- Hurricane tracking via NOAA National Hurricane Center (active storms, forecast cones, full track history)
- Wildfire detection via NASA FIRMS (USA and global fire data)
- Severe weather alerts via NWS (tornado warnings, flood alerts, hail reports, SPC storm reports)
- Real-time push notifications via Flask-SocketIO WebSocket connections

#### Parametric Insurance Analysis
- Hurricane bounding-box trigger analysis with IBTrACS and HURDAT2 datasets
- Earthquake bounding-box analysis with USGS historical dataset
- Historical event intersection detection with entry/exit point calculation
- Poisson probability modeling for trigger frequency estimation
- Bulk multi-box statistical analysis for portfolio-level assessment
- Configurable trigger criteria (wind speed, pressure, magnitude thresholds)
- Dataset metadata endpoints (available basins, year ranges, dataset info)

#### Indemnity Analysis
- Historical earthquake retrieval with composite significance scoring
- Historical hurricane retrieval with full track data for TIV overlay
- Significance scoring algorithms (magnitude/depth for earthquakes, category/wind/pressure for hurricanes)
- Configurable modes: "significant" (top-N by score) and "all" (full dataset)
- Dataset summary endpoint for UI integration

#### Email Alert Subscriptions
- Email subscription management with verification flow
- Rate-limited subscribe/unsubscribe/resubscribe lifecycle
- Preference management per subscriber (event types, thresholds)
- Background email sending via threading
- Privacy-safe uniform responses to prevent email enumeration

#### UI & Frontend
- Jinja2 template inheritance with `base.html` layout
- HTMX-powered interactivity without a SPA framework
- Tailwind CSS utility-first styling
- MapLibre GL JS interactive maps for all disaster types
- Dashboard page with multi-hazard overview
- Parametric live tracking and historical analysis pages
- Indemnity live catastrophe and historical analysis pages
- Custom error pages (404, 500, generic)

#### Observability
- Structured JSON logging via structlog
- Prometheus metrics endpoint (`/metrics`) with request counters, latency histograms, WebSocket gauge, and external API call counters
- Health check endpoint (`/api/v1/health`) with database connectivity status
- Request timing exposed via `X-Request-Duration` response header

#### Infrastructure
- Docker multi-stage build with non-root user
- docker-compose stack with PostGIS 16-3.4 and Redis 7 Alpine
- SQLAlchemy 2.0 with `mapped_column` and connection pool configuration
- Alembic migrations via Flask-Migrate
- GeoAlchemy2 for PostGIS spatial queries
- Gunicorn with eventlet worker for production deployment
- Pydantic v2 request/response validation schemas

#### Testing
- pytest test suite mirroring application structure
- Application factory tests
- Blueprint/endpoint integration tests
- Configuration loading tests
- Core infrastructure tests (auth, middleware, exceptions, response)
- Schema validation tests
- Service layer unit tests
- Utility function tests
- Shared fixtures in `conftest.py`

#### External API Clients
- `usgs_client` — USGS Earthquake Hazards Program real-time data
- `usgs_historical_client` — USGS historical earthquake catalog
- `noaa_client` — NOAA National Hurricane Center active storms and forecasts
- `nws_client` — National Weather Service alerts and SPC storm reports
- `nasa_firms_client` — NASA FIRMS active fire detections
- `ibtracs_client` — IBTrACS international best track archive
- `hurdat2_client` — HURDAT2 Atlantic and Pacific hurricane database
