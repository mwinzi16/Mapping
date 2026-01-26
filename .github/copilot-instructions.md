# Catastrophe Mapping - AI Coding Guidelines

## Architecture Overview
Monorepo with `apps/api` (FastAPI, port 8000) and `apps/web` (React+Vite, port 5173). Real-time events flow: External APIs → `services/*_client.py` → `realtime_service.py` → WebSocket → Zustand stores.

## Environment Setup
```bash
# Backend setup (create virtual env named "mapping")
cd apps/api
python -m venv mapping
mapping\Scripts\activate              # Windows
source mapping/bin/activate           # macOS/Linux
pip install -r requirements.txt
cp .env.example .env                  # Edit with your DB credentials

# Frontend setup
cd apps/web
npm install
```

## Key Commands
```bash
cd apps/api && mapping\Scripts\activate && uvicorn app.main:app --reload  # Backend
cd apps/web && npm run dev                                                 # Frontend
cd apps/api && alembic upgrade head                                        # Migrations
cd apps/api && alembic revision --autogenerate -m "description"            # New migration
```

## Database Patterns (PostgreSQL + PostGIS)
- **Engine**: Async SQLAlchemy with `asyncpg` driver (`DATABASE_URL` uses `postgresql+asyncpg://`)
- **Sessions**: Use `db: AsyncSession = Depends(get_db)` in routers (auto-commits, rollback on error)
- **Models**: Inherit from `Base` in `core/database.py`, use `Mapped[]` type hints
- **Geospatial**: Use `geoalchemy2.Geometry("POINT", srid=4326)` for location fields
- **Migrations**: Alembic with async support, PostGIS extension required

```python
# Model pattern (see models/earthquake.py)
class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    geometry = mapped_column(Geometry("POINT", srid=4326))  # PostGIS
```

## Backend Patterns (apps/api)

### Adding New Event Types
1. Create client in `services/` (see `usgs_client.py` for async `httpx` pattern)
2. Add schema in `schemas/` with `BaseModel`, `Create`, `Response` variants
3. Create router in `routers/` using dependency injection: `db: AsyncSession = Depends(get_db)`
4. Register in `main.py`: `app.include_router(new_router, prefix="/api/...", tags=[...])`
5. Add to `realtime_service.py` polling loop for live updates

### WebSocket Events
`notifications.py` manages connections. Broadcast via `manager.broadcast(msg, event_type)`. 
Event types: `earthquake`, `hurricane`, `wildfire`, `tornado`, `flooding`, `hail`

## Frontend Patterns (apps/web)

### State Management (Zustand)
- `eventStore.ts`: Live catastrophe events, filtering, notifications
- `parametricStore.ts`: Hurricane historical analysis with bounding boxes
- `earthquakeParametricStore.ts`: Earthquake parametric analysis
- `indemnityStore.ts`: TIV (Total Insured Value) portfolio data
- Pattern: fetch methods update state, components subscribe via hooks

### Map Components
Uses MapLibre GL (free, OpenStreetMap tiles). See `components/Map.tsx` for event layers.
Parametric analysis: `components/parametric/` folder with peril-specific maps and panels.

## Parametric vs Indemnity Workflows

### Parametric Insurance (`/parametric/*`)
Historical analysis with trigger zones. User draws bounding boxes on map, system calculates:
- How many historical events (hurricanes/earthquakes) crossed the zone
- Event intensity at intersection (wind speed, magnitude)
- Payout tiers based on `PayoutStructure` (binary, percentage, or tiered)
- Types: `BoundingBox`, `TriggerCriteria`, `PayoutTier` in `types/parametric.ts`
- Stores: `parametricStore.ts` (hurricanes), `earthquakeParametricStore.ts` (earthquakes)
- Components: `components/parametric/` (22+ specialized panels)

### Indemnity Insurance (`/indemnity/*`)
Portfolio-based exposure analysis. User uploads TIV data, system overlays live events:
- `TIVDataset`: Collection of insured locations with values
- `TIVImpactAnalysis`: Events intersecting portfolio locations
- Live cat: Real-time events + TIV exposure (`IndemnityLiveCat.tsx`)
- Historical: Past event paths + portfolio impact
- Store: `indemnityStore.ts`, types in `types/indemnity.ts`

## Testing Patterns
```bash
cd apps/api
pytest                              # Run all tests
pytest -v tests/test_earthquakes.py # Specific test file
pytest --cov=app                    # With coverage
```
- Use `pytest-asyncio` for async tests with `@pytest.mark.asyncio`
- Mock external APIs with `httpx.MockTransport` or `respx`
- Test files: `tests/test_{router_name}.py`

## Naming Conventions
- **Backend**: snake_case routes (`/api/severe-weather/alerts`), Pydantic schemas PascalCase
- **Frontend**: Components PascalCase, hooks `useCamelCase`, stores `use{Feature}Store`
- **Shared IDs**: `usgs_id`, `storm_id`, `source_id` match external API identifiers

## External APIs (no keys required for basic usage)
- USGS: `earthquake.usgs.gov/fdsnws/event/1` (GeoJSON format)
- IBTrACS: Historical hurricanes for parametric analysis
- NOAA NHC: Active hurricanes
- NASA FIRMS: Wildfires (optional API key for higher limits)
- NWS: Severe weather alerts
