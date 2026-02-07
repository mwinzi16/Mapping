"""
Earthquake business logic service.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.earthquake import Earthquake
from app.schemas.earthquake import EarthquakeList, EarthquakeResponse


class EarthquakeService:
    """Service for earthquake-related operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    @staticmethod
    def _apply_filters(
        query,
        *,
        min_magnitude: Optional[float] = None,
        max_magnitude: Optional[float] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ):
        """Apply common earthquake filters to a query."""
        if min_magnitude is not None:
            query = query.where(Earthquake.magnitude >= min_magnitude)
        if max_magnitude is not None:
            query = query.where(Earthquake.magnitude <= max_magnitude)
        if start_date:
            query = query.where(Earthquake.event_time >= start_date)
        if end_date:
            query = query.where(Earthquake.event_time <= end_date)
        return query

    async def get_earthquakes(
        self,
        min_magnitude: Optional[float] = None,
        max_magnitude: Optional[float] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> EarthquakeList:
        """Get paginated list of earthquakes with filters."""
        filter_kwargs = dict(
            min_magnitude=min_magnitude,
            max_magnitude=max_magnitude,
            start_date=start_date,
            end_date=end_date,
        )

        # Build query
        query = self._apply_filters(select(Earthquake), **filter_kwargs)
        count_query = self._apply_filters(
            select(func.count(Earthquake.id)), **filter_kwargs
        )
        
        # Get total count
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Apply pagination
        offset = (page - 1) * per_page
        query = query.order_by(Earthquake.event_time.desc())
        query = query.offset(offset).limit(per_page)
        
        # Execute query
        result = await self.db.execute(query)
        earthquakes = result.scalars().all()
        
        # Convert to response format
        items = [
            EarthquakeResponse.from_orm_with_geometry(eq)
            for eq in earthquakes
        ]
        
        return EarthquakeList(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
        )
    
    async def get_by_id(self, earthquake_id: int) -> Optional[Earthquake]:
        """Get a single earthquake by ID."""
        query = select(Earthquake).where(Earthquake.id == earthquake_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_usgs_id(self, usgs_id: str) -> Optional[Earthquake]:
        """Get a single earthquake by USGS ID."""
        query = select(Earthquake).where(Earthquake.usgs_id == usgs_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def create(self, data: dict) -> Earthquake:
        """Create a new earthquake record."""
        earthquake = Earthquake(**data)
        self.db.add(earthquake)
        await self.db.flush()
        await self.db.refresh(earthquake)
        return earthquake
    
    async def upsert(self, data: dict) -> Earthquake:
        """Create or update an earthquake by USGS ID using atomic upsert."""
        stmt = pg_insert(Earthquake).values(**data)
        stmt = stmt.on_conflict_do_update(
            index_elements=["usgs_id"],
            set_={k: v for k, v in data.items() if k != "usgs_id"},
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        # Fetch the upserted record
        return await self.db.get(
            Earthquake,
            data.get("usgs_id") or result.inserted_primary_key[0],
        )
    
    async def get_recent(
        self,
        hours: int = 24,
        min_magnitude: float = 2.5
    ) -> List[Earthquake]:
        """Get recent earthquakes."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        query = (
            select(Earthquake)
            .where(Earthquake.event_time >= cutoff)
            .where(Earthquake.magnitude >= min_magnitude)
            .order_by(Earthquake.event_time.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
