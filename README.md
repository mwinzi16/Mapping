# 🌍 Catastrophe Mapping

Real-time earthquake and hurricane tracking application with interactive maps and live notifications.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- 🗺️ **Interactive Map** - Real-time visualization of earthquakes and hurricanes
- 🔔 **Live Notifications** - Push alerts for significant events via WebSocket
- 📊 **Historical Data** - Browse and analyze past catastrophe events
- 🔍 **Filtering** - Filter by magnitude, category, date range, and location
- 📱 **Responsive** - Works on desktop and mobile browsers

## Tech Stack

### Backend
- **Python 3.11+** with FastAPI
- **PostgreSQL** with PostGIS for geospatial data
- **Redis** for caching and pub/sub
- **SQLAlchemy** async ORM
- **USGS & NOAA** APIs for data ingestion

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **MapLibre GL JS** for map rendering (free, no API key!)
- **Zustand** for state management
- **Tailwind CSS** for styling
- **WebSocket** for real-time updates

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ with PostGIS extension (optional for MVP)
- Redis (optional, for caching)
- **No API keys needed!** Maps use free OpenStreetMap-based tiles

### Backend Setup

```bash
# Navigate to API directory
cd apps/api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
# Navigate to web directory
cd apps/web

# Install dependencies
npm install
Start development server (no API keys needed!)
# Start development server
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **API Health**: http://localhost:8000/api/health

## API Endpoints

### Earthquakes
- `GET /api/earthquakes/recent` - Recent earthquakes (last 24h)
- `GET /api/earthquakes/significant` - Significant earthquakes (M4.5+)
- `GET /api/earthquakes/{id}` - Single earthquake details
- `GET /api/earthquakes/usgs/{usgs_id}` - Fetch from USGS by ID

### Hurricanes
- `GET /api/hurricanes/active` - Currently active storms
- `GET /api/hurricanes/season/{year}` - Historical season data
- `GET /api/hurricanes/{id}` - Single hurricane details
- `GET /api/hurricanes/{id}/track` - Hurricane path as GeoJSON

### Real-time
- `WS /api/notifications/ws` - WebSocket for live updates

## Project Structure

```
Mapping/
├── apps/
│   ├── api/                 # Python FastAPI backend
│   │   ├── app/
│   │   │   ├── core/        # Config, database
│   │   │   ├── models/      # SQLAlchemy models
│   │   │   ├── routers/     # API endpoints
│   │   │   ├── schemas/     # Pydantic schemas
│   │   │   └── services/    # Business logic
│   │   └── requirements.txt
│   └── web/                 # React TypeScript frontend
│       ├── src/
│       │   ├── components/  # React components
│       │   ├── hooks/       # Custom hooks
│       │   ├── services/    # API client
│       │   ├── stores/      # Zustand stores
│       │   └── types/       # TypeScript types
│       └── package.json
├── .github/
│   └── copilot-instructions.md
└── README.md
```

## Data Sources

| Source | Data | Update Frequency |
|--------|------|------------------|
| [USGS Earthquake API](https://earthquake.usgs.gov/fdsnws/event/1/) | Global earthquakes | Real-time |
| [NOAA NHC](https://www.nhc.noaa.gov/) | Atlantic/Pacific hurricanes | During season |
| [IBTrACS](https://www.ncei.noaa.gov/products/international-best-track-archive-for-climate-stewardship-ibtracs) | Historical hurricanes | Periodic |

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/catastrophe_db
REDIS_URL=redis://localhost:6379/0
MAPBOX_TOKEN=your_token
```

### Frontend (.env.local)
```

### Frontend (.env.local) - Optional
```
VITE_API_URL=http://localhost:8000/api
VITE_MAP_STYLE=dark  # Options: dark, light, voyager
```

> **Note:** No API keys required! The app uses free CARTO basemaps powered by OpenStreetMap.Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.
