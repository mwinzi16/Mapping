"""
Hurricane business logic service.
"""
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hurricane import Hurricane
from app.schemas.hurricane import HurricaneList, HurricaneResponse


class HurricaneService:
    """Service for hurricane-related operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_hurricanes(
        self,
        basin: Optional[str] = None,
        is_active: Optional[bool] = None,
        min_category: Optional[int] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> HurricaneList:
        """Get paginated list of hurricanes with filters."""
        
        # Build query
        query = select(Hurricane)
        count_query = select(func.count(Hurricane.id))
        
        # Apply filters
        if basin:
            query = query.where(Hurricane.basin == basin)
            count_query = count_query.where(Hurricane.basin == basin)
        
        if is_active is not None:
            query = query.where(Hurricane.is_active == is_active)
            count_query = count_query.where(Hurricane.is_active == is_active)
        
        if min_category is not None:
            query = query.where(Hurricane.category >= min_category)
            count_query = count_query.where(Hurricane.category >= min_category)
        
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
    
    async def get_track(self, hurricane_id: int) -> Optional[Dict[str, Any]]:
        """Get hurricane track as GeoJSON."""
        hurricane = await self.get_by_id(hurricane_id)
        
        if not hurricane or not hurricane.track:
            return None
        
        # Convert PostGIS geometry to GeoJSON
        # This is simplified - real implementation would use ST_AsGeoJSON
        return {
            "type": "LineString",
            "coordinates": []  # Would be populated from track geometry
        }
    
    async def create(self, data: dict) -> Hurricane:
        """Create a new hurricane record."""
        hurricane = Hurricane(**data)
        self.db.add(hurricane)
        await self.db.flush()
        await self.db.refresh(hurricane)
        return hurricane
    
    async def upsert(self, data: dict) -> Hurricane:
        """Create or update a hurricane by storm ID."""
        existing = await self.get_by_storm_id(data["storm_id"])
        
        if existing:
            # Update existing record
            for key, value in data.items():
                setattr(existing, key, value)
            await self.db.flush()
            return existing
        else:
            # Create new record
            return await self.create(data)
    
    async def get_active(self) -> List[Hurricane]:
        """Get all currently active storms."""
        query = (
            select(Hurricane)
            .where(Hurricane.is_active == True)
            .order_by(Hurricane.max_wind_mph.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
