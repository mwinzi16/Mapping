# Catastrophe Analysis Platform

Enterprise-grade Flask application for real-time natural disaster monitoring, parametric insurance analysis, and indemnity risk quantification. Integrates live data feeds from USGS, NOAA, NASA FIRMS, and NWS to provide a unified catastrophe intelligence dashboard with interactive maps, configurable email alerts, and statistical analysis tools.

---

## Features

### Real-Time Monitoring
- **Earthquakes** — Live seismic data from the USGS Earthquake Hazards Program with magnitude filtering and GeoJSON output
- **Hurricanes** — Active tropical storm tracking via NOAA National Hurricane Center with forecast cones and full track history
- **Wildfires** — Active fire detections from NASA FIRMS (Fire Information for Resource Management System)
- **Severe Weather** — Tornado warnings, flood alerts, hail reports, and SPC storm reports from the National Weather Service

### Parametric Insurance Analysis
- Hurricane bounding-box trigger analysis with configurable wind speed and pressure thresholds
- Earthquake bounding-box analysis with magnitude and depth filters
- Historical event intersection detection with entry/exit point calculation
- Poisson probability modeling for trigger frequency estimation
- Bulk multi-box statistical analysis
- Support for IBTrACS, HURDAT2 (Atlantic & Pacific), and USGS earthquake datasets

### Indemnity Analysis
- Total Insured Value (TIV) impact assessment via historical event overlay
- Composite significance scoring for earthquakes (magnitude, depth, USGS metrics) and hurricanes (category, wind speed, pressure)
- Full track data for hurricane path visualization over exposure portfolios
- Configurable filters: year range, magnitude/category thresholds, basin selection

### Email Alerts
- Configurable subscription management with email verification
- Threshold-based alerting with per-subscriber preferences
- Rate-limited subscribe/unsubscribe/resubscribe lifecycle
- Privacy-safe — uniform responses prevent email enumeration

### Real-Time Updates
- WebSocket push notifications via Flask-SocketIO
- Live dashboard updates without page refresh
- Configurable connection limits for production scaling

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Flask 3.1 with Application Factory pattern |
| **ORM** | SQLAlchemy 2.0 (`mapped_column` / `DeclarativeBase`) |
| **Database** | PostgreSQL 16 + PostGIS 3.4 (GeoAlchemy2) |
| **Migrations** | Alembic via Flask-Migrate |
| **Validation** | Pydantic v2 |
| **Real-time** | Flask-SocketIO (WebSocket) |
| **HTTP Client** | httpx (async-capable) |
| **Task Queue** | Celery 5.4 + Redis 7 |
| **Caching** | Redis 5 |
| **Logging** | structlog (JSON structured logging) |
| **Metrics** | Prometheus (`prometheus-client`) |
| **Security** | Flask-Talisman, Flask-Limiter, API key auth |
| **CORS** | Flask-CORS |
| **UI** | Jinja2 + HTMX + Tailwind CSS |
| **Maps** | MapLibre GL JS |
| **Container** | Docker multi-stage build, docker compose |
| **WSGI** | Gunicorn with eventlet worker |

---

## Project Structure

```
Mapping/
├── run.py                          # Application entry point
├── requirements.txt                # Pinned Python dependencies
├── Dockerfile                      # Multi-stage production image
├── docker-compose.yml              # Full stack (app + PostGIS + Redis)
├── .env.example                    # Environment variable template
├── .gitignore
├── CHANGELOG.md
├── README.md
└── app/
    ├── __init__.py                 # create_app() — Application Factory
    ├── config.py                   # Settings dataclass (env-driven)
    ├── extensions.py               # Flask extension initialization
    ├── database.py                 # SQLAlchemy session helpers
    ├── blueprints/                 # Route handlers (thin controllers)
    │   ├── __init__.py
    │   ├── main.py                 # Web UI routes (Jinja2 pages)
    │   ├── api_earthquakes.py      # /api/v1/earthquakes
    │   ├── api_hurricanes.py       # /api/v1/hurricanes
    │   ├── api_wildfires.py        # /api/v1/wildfires
    │   ├── api_severe_weather.py   # /api/v1/severe-weather
    │   ├── api_subscriptions.py    # /api/v1/subscriptions
    │   ├── api_parametric.py       # /api/v1/parametric
    │   ├── api_earthquake_parametric.py  # /api/v1/earthquake-parametric
    │   └── api_indemnity.py        # /api/v1/indemnity
    ├── models/                     # SQLAlchemy models (one per domain)
    │   ├── __init__.py
    │   ├── earthquake.py
    │   ├── hurricane.py
    │   ├── wildfire.py
    │   ├── severe_weather.py
    │   └── subscription.py
    ├── schemas/                    # Pydantic v2 request/response schemas
    │   ├── __init__.py
    │   ├── earthquake.py
    │   ├── earthquake_parametric.py
    │   ├── hurricane.py
    │   ├── wildfire.py
    │   ├── severe_weather.py
    │   ├── parametric.py
    │   ├── indemnity.py
    │   └── subscription.py
    ├── services/                   # Business logic (no Flask imports)
    │   ├── __init__.py
    │   ├── earthquake_service.py
    │   ├── earthquake_parametric_service.py
    │   ├── hurricane_service.py
    │   ├── parametric_service.py
    │   ├── indemnity_service.py
    │   ├── subscription_service.py
    │   ├── email_service.py
    │   ├── realtime_service.py
    │   ├── usgs_client.py
    │   ├── usgs_historical_client.py
    │   ├── noaa_client.py
    │   ├── nws_client.py
    │   ├── nasa_firms_client.py
    │   ├── ibtracs_client.py
    │   └── hurdat2_client.py
    ├── core/                       # Cross-cutting infrastructure
    │   ├── __init__.py
    │   ├── auth.py                 # API key decorator
    │   ├── clients.py              # HTTP client factory
    │   ├── exceptions.py           # Custom exception hierarchy
    │   ├── logging.py              # structlog configuration
    │   ├── metrics.py              # Prometheus metrics & /metrics endpoint
    │   ├── middleware.py           # Correlation ID & security headers
    │   └── response.py             # Standard JSON response envelopes
    ├── utils/                      # Pure helper functions
    │   ├── __init__.py
    │   ├── cache.py
    │   ├── geojson.py
    │   ├── privacy.py
    │   └── weather.py
    ├── templates/                  # Jinja2 + HTMX templates
    │   ├── base.html
    │   ├── pages/
    │   │   ├── index.html
    │   │   ├── parametric_live.html
    │   │   ├── parametric_historical.html
    │   │   ├── indemnity_live.html
    │   │   └── indemnity_historical.html
    │   └── errors/
    │       ├── 404.html
    │       ├── 500.html
    │       └── generic.html
    ├── static/                     # Tailwind output, JS
    │   └── js/
    │       ├── app.js
    │       ├── map.js
    │       ├── parametric.js
    │       ├── indemnity.js
    │       └── realtime.js
    └── tests/                      # pytest test suite
        ├── __init__.py
        ├── conftest.py
        ├── test_app_factory.py
        ├── test_blueprints.py
        ├── test_config.py
        ├── test_core.py
        ├── test_schemas.py
        ├── test_services.py
        └── test_utils.py
```

---

## Setup / Installation

### Prerequisites

- Python 3.12+
- PostgreSQL 16 with PostGIS 3.4 extension
- Redis 7 (for caching and Celery broker)

### Local Development

```bash
cd Mapping
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # edit settings
flask db upgrade
python run.py
```

The application starts at `http://localhost:5000`.

### Docker

```bash
docker compose up -d
```

This starts three services:
- **app** — Flask application on port `5000`
- **db** — PostGIS 16-3.4 on port `5432`
- **redis** — Redis 7 Alpine on port `6379`

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `Catastrophe Mapping API` | Display name used in logs and email templates |
| `DEBUG` | `false` | Enable debug mode (`true` / `false`) |
| `SECRET_KEY` | `change-me-in-production` | Flask session secret — **must** override in production |
| `API_KEY` | *(empty)* | API key for protected endpoints |
| `API_KEY_ENABLED` | `false` | Enable API key authentication (`true` / `false`) |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/catastrophe_db` | SQLAlchemy database URI (PostGIS) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed CORS origins |
| `USGS_API_BASE` | `https://earthquake.usgs.gov/fdsnws/event/1` | USGS Earthquake API base URL |
| `NOAA_API_BASE` | `https://www.nhc.noaa.gov/CurrentStorms.json` | NOAA National Hurricane Center API |
| `NASA_FIRMS_API_KEY` | *(none)* | NASA FIRMS API key for wildfire data |
| `SMTP_HOST` | `localhost` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | *(none)* | SMTP authentication username |
| `SMTP_PASSWORD` | *(none)* | SMTP authentication password |
| `FROM_EMAIL` | `alerts@catastrophe-mapping.com` | Sender email address for alerts |
| `FROM_NAME` | `Catastrophe Mapping Alerts` | Sender display name |
| `MAPBOX_TOKEN` | *(empty)* | Mapbox token for geocoding (optional) |
| `MAX_WS_CONNECTIONS` | `1000` | Maximum concurrent WebSocket connections |
| `RATE_LIMIT_DEFAULT` | `100/minute` | Default rate limit for all endpoints |

---

## API Endpoints

All API routes return a standard JSON envelope:
```json
{
  "data": "...",
  "meta": {},
  "errors": []
}
```

### Health & Metrics

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Health check with database connectivity status |
| `GET` | `/metrics` | Prometheus metrics endpoint |

### Web UI (main)

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Main dashboard |
| `GET` | `/parametric` | Redirect to `/parametric/live` |
| `GET` | `/parametric/live` | Real-time parametric tracking page |
| `GET` | `/parametric/historical` | Parametric historical analysis page |
| `GET` | `/indemnity` | Redirect to `/indemnity/live` |
| `GET` | `/indemnity/live` | Indemnity live catastrophe page |
| `GET` | `/indemnity/historical` | Indemnity historical analysis page |

### Earthquakes (`/api/v1/earthquakes`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/earthquakes/` | — | Paginated earthquake list with filters |
| `GET` | `/api/v1/earthquakes/recent` | — | Recent earthquakes from USGS (configurable hours) |
| `GET` | `/api/v1/earthquakes/significant` | — | Significant earthquakes M4.5+ (configurable days) |
| `GET` | `/api/v1/earthquakes/<id>` | — | Get earthquake by database ID |
| `GET` | `/api/v1/earthquakes/usgs/<usgs_id>` | — | Get earthquake by USGS event ID |

### Hurricanes (`/api/v1/hurricanes`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/hurricanes/` | — | Paginated hurricane list with filters |
| `GET` | `/api/v1/hurricanes/active` | — | Currently active storms from NOAA |
| `GET` | `/api/v1/hurricanes/season/<year>` | — | All hurricanes from a specific season |
| `GET` | `/api/v1/hurricanes/<id>` | — | Get hurricane by ID with full track |
| `GET` | `/api/v1/hurricanes/<id>/track` | — | Hurricane track as GeoJSON Feature |
| `GET` | `/api/v1/hurricanes/<id>/forecast` | — | Forecast cone for active hurricanes |

### Wildfires (`/api/v1/wildfires`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/wildfires/active` | — | Active fire detections from NASA FIRMS |
| `GET` | `/api/v1/wildfires/major` | — | Major/named wildfires (NIFC integration) |

### Severe Weather (`/api/v1/severe-weather`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/severe-weather/alerts` | — | Active severe weather alerts (filterable by type, state, severity) |
| `GET` | `/api/v1/severe-weather/tornadoes` | — | Active tornado warnings and watches |
| `GET` | `/api/v1/severe-weather/flooding` | — | Active flood warnings and watches |
| `GET` | `/api/v1/severe-weather/hail` | — | Severe thunderstorm / hail alerts |
| `GET` | `/api/v1/severe-weather/storm-reports` | — | Today's SPC storm reports |

### Subscriptions (`/api/v1/subscriptions`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/subscriptions/subscribe` | API Key | Subscribe to catastrophe alerts |
| `GET` | `/api/v1/subscriptions/verify/<token>` | — | Verify email via token |
| `GET` | `/api/v1/subscriptions/unsubscribe/<token>` | — | Unsubscribe via token |
| `GET` | `/api/v1/subscriptions/preferences/<email>` | — | Get subscription preferences |
| `PUT` | `/api/v1/subscriptions/preferences/<email>` | API Key | Update subscription preferences |
| `POST` | `/api/v1/subscriptions/resubscribe/<email>` | API Key | Reactivate subscription |

### Parametric — Hurricanes (`/api/v1/parametric`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/parametric/datasets` | — | Available hurricane datasets |
| `GET` | `/api/v1/parametric/hurricanes/historical` | — | Historical hurricanes with filters |
| `POST` | `/api/v1/parametric/analysis/intersections` | API Key | Hurricane–box intersection analysis |
| `POST` | `/api/v1/parametric/analysis/statistics` | API Key | Trigger box statistical analysis |
| `POST` | `/api/v1/parametric/analysis/bulk-statistics` | API Key | Multi-box bulk statistics |
| `GET` | `/api/v1/parametric/basins` | — | Available ocean basins per dataset |
| `GET` | `/api/v1/parametric/year-range` | — | Available year range for historical data |

### Parametric — Earthquakes (`/api/v1/earthquake-parametric`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/earthquake-parametric/datasets` | — | Available earthquake datasets |
| `GET` | `/api/v1/earthquake-parametric/earthquakes/historical` | — | Historical earthquakes with filters |
| `POST` | `/api/v1/earthquake-parametric/analysis/earthquakes` | API Key | Earthquakes-in-box analysis |
| `POST` | `/api/v1/earthquake-parametric/analysis/statistics` | API Key | Earthquake trigger box statistics |
| `POST` | `/api/v1/earthquake-parametric/analysis/bulk-statistics` | API Key | Multi-box bulk earthquake statistics |

### Indemnity (`/api/v1/indemnity`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/indemnity/historical/earthquakes` | API Key | Historical earthquakes for TIV analysis |
| `GET` | `/api/v1/indemnity/historical/hurricanes` | API Key | Historical hurricanes with track data for TIV analysis |
| `GET` | `/api/v1/indemnity/historical/summary` | — | Dataset metadata summary for UI |

---

## Authentication

Protected endpoints require an API key via either:
- **Header**: `X-API-Key: <your-key>`
- **Query parameter**: `?api_key=<your-key>`

Set `API_KEY_ENABLED=true` and provide `API_KEY` in environment variables. When `API_KEY_ENABLED=false`, authentication is bypassed (development mode).

---

## Error Handling

All errors follow a consistent JSON envelope:

```json
{
  "data": null,
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "min_magnitude must be between 0 and 10",
      "details": null
    }
  ]
}
```

Custom exception hierarchy rooted at `AppError`:
- `NotFoundError` (404)
- `ValidationError` (422)
- `AuthenticationError` (401)
- `AuthorizationError` (403)
- `ExternalServiceError` (502)
- `RateLimitError` (429)

---

## Data Sources

| Source | Data | Update Frequency |
|---|---|---|
| [USGS Earthquake API](https://earthquake.usgs.gov/fdsnws/event/1/) | Global earthquakes | Real-time |
| [NOAA NHC](https://www.nhc.noaa.gov/) | Atlantic/Pacific hurricanes | During season |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) | Global wildfire detections | Near real-time |
| [NWS / SPC](https://api.weather.gov/) | Severe weather alerts & storm reports | Real-time |
| [IBTrACS](https://www.ncei.noaa.gov/products/international-best-track-archive-for-climate-stewardship-ibtracs) | Historical hurricanes (1850–present) | Periodic |
| [HURDAT2](https://www.nhc.noaa.gov/data/) | Historical hurricanes (Atlantic & Pacific) | Annual |

---

## Testing

```bash
pytest app/tests/ -v --cov=app
```

The test suite includes:
- **Application factory** tests (`test_app_factory.py`)
- **Blueprint / endpoint** tests (`test_blueprints.py`)
- **Configuration** tests (`test_config.py`)
- **Core infrastructure** tests (`test_core.py`)
- **Schema validation** tests (`test_schemas.py`)
- **Service layer** tests (`test_services.py`)
- **Utility function** tests (`test_utils.py`)

Fixtures are configured in `conftest.py` with app, client, and database session helpers.

---

## Architecture

### Application Factory

The `create_app()` function in `app/__init__.py` initializes:
1. Configuration loading from environment variables via `Settings` dataclass
2. Extension initialization (SQLAlchemy, Migrate, CORS, Limiter, Talisman, SocketIO)
3. Blueprint registration with versioned URL prefixes
4. Global error handlers (JSON for API routes, HTML for web routes)
5. Middleware hooks (correlation ID, security headers, request timing)
6. Health check and Prometheus metrics endpoints
7. Background monitoring thread

### Service Layer

Business logic lives in `app/services/` with no Flask imports — services are framework-agnostic and testable in isolation. External API clients (`usgs_client`, `noaa_client`, `nws_client`, `nasa_firms_client`, `ibtracs_client`, `hurdat2_client`) encapsulate all third-party HTTP interactions.

### Response Envelope

All API responses use a standard envelope via `app/core/response.py`:
- `success_response(data, meta)` → `{"data": ..., "meta": ...}`
- `error_response(code, message, details)` → `{"data": null, "errors": [...]}`
- `paginated_response(items, total, page, per_page)` → includes pagination metadata

### Observability

- **Structured logging** via structlog with JSON output in production and console rendering in debug mode
- **Correlation IDs** injected per-request via `X-Correlation-ID` header
- **Prometheus metrics** at `/metrics` (request counts, latency histograms, WebSocket gauge, external API call counters)
- **Request timing** exposed via `X-Request-Duration` response header

---

## License

Proprietary — internal use only.
