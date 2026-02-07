"""
Hurricane business logic service.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hurricane import Hurricane
from app.schemas.hurricane import HurricaneList, HurricaneResponse


class HurricaneService:
    """Service for hurricane-related operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    @staticmethod
    def _apply_filters(
        query,
        *,
        basin: Optional[str] = None,
        is_active: Optional[bool] = None,
        min_category: Optional[int] = None,
    ):
        """Apply common hurricane filters to a query."""
        if basin:
            query = query.where(Hurricane.basin == basin)
        if is_active is not None:
            query = query.where(Hurricane.is_active == is_active)
        if min_category is not None:
            query = query.where(Hurricane.category >= min_category)
        return query

    async def get_hurricanes(
        self,
        basin: Optional[str] = None,
        is_active: Optional[bool] = None,
        min_category: Optional[int] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> HurricaneList:
        """Get paginated list of hurricanes with filters."""
        filter_kwargs = dict(
            basin=basin,
            is_active=is_active,
            min_category=min_category,
        )

        # Build query
        query = self._apply_filters(select(Hurricane), **filter_kwargs)
        count_query = self._apply_filters(
            select(func.count(Hurricane.id)), **filter_kwargs
        )
        
        # Get total count
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Apply pagination
        offset = (page - 1) * per_page
        query = query.order_by(Hurricane.advisory_time.desc())
        query = query.offset(offset).limit(per_page)
        
        # Execute query
        result = await self.db.execute(query)
        hurricanes = result.scalars().all()
        
        # Convert to response format
        items = [
            HurricaneResponse.from_orm_with_geometry(h)
            for h in hurricanes
        ]
        
        return HurricaneList(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
        )
    
    async def get_by_id(self, hurricane_id: int) -> Optional[Hurricane]:
        """Get a single hurricane by ID."""
        query = select(Hurricane).where(Hurricane.id == hurricane_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_storm_id(self, storm_id: str) -> Optional[Hurricane]:
        """Get a single hurricane by NOAA storm ID."""
        query = select(Hurricane).where(Hurricane.storm_id == storm_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_season(
        self,
        year: int,
        basin: Optional[str] = None
    ) -> List[Hurricane]:
        """Get all hurricanes from a specific year/season."""
        query = select(Hurricane).where(
            func.extract("year", Hurricane.advisory_time) == year
        )
        
        if basin:
            query = query.where(Hurricane.basin == basin)
        
        query = query.order_by(Hurricane.advisory_time.asc())
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_track(self, hurricane_id: int) -> dict:
        """Get hurricane track as GeoJSON."""
        from geoalchemy2.functions import ST_AsGeoJSON

        result = await self.db.execute(
            select(
                func.ST_AsGeoJSON(Hurricane.track).label("track_geojson")
            ).where(Hurricane.id == hurricane_id)
        )
        row = result.scalar_one_or_none()
        if row:
            import json

            return json.loads(row)
        return {"type": "LineString", "coordinates": []}
    
    async def create(self, data: dict) -> Hurricane:
        """Create a new hurricane record."""
        hurricane = Hurricane(**data)
        self.db.add(hurricane)
        await self.db.flush()
        await self.db.refresh(hurricane)
        return hurricane
    
    async def upsert(self, data: dict) -> Hurricane:
        """Create or update a hurricane by storm ID using atomic upsert."""
        stmt = pg_insert(Hurricane).values(**data)
        stmt = stmt.on_conflict_do_update(
            index_elements=["storm_id"],
            set_={k: v for k, v in data.items() if k != "storm_id"},
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        # Fetch the upserted record
        return await self.db.get(
            Hurricane,
            data.get("storm_id") or result.inserted_primary_key[0],
        )
    
    async def get_active(self) -> List[Hurricane]:
        """Get all currently active storms."""
        query = (
            select(Hurricane)
            .where(Hurricane.is_active == True)
            .order_by(Hurricane.max_wind_mph.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
