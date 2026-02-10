"""Hurricane service — database operations for hurricane events.

Synchronous service using Flask-SQLAlchemy's ``db.session``.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import List, Optional

from geoalchemy2.functions import ST_AsGeoJSON
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.extensions import db
from app.models.hurricane import Hurricane
from app.schemas.hurricane import HurricaneList, HurricaneResponse


class HurricaneService:
    """Service layer for hurricane CRUD and query operations."""

    @staticmethod
    def _apply_filters(
        query,  # noqa: ANN001
        *,
        basin: Optional[str] = None,
        min_category: Optional[int] = None,
        is_active: Optional[bool] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        name: Optional[str] = None,
    ):
        """Apply optional filters to a SQLAlchemy hurricane query.

        Args:
            query: An existing ``select()`` statement.
            basin: Ocean basin code (e.g. ``"AL"``).
            min_category: Minimum Saffir-Simpson category.
            is_active: Filter by active status.
            start_date: Earliest advisory time (inclusive).
            end_date: Latest advisory time (inclusive).
            name: Storm name substring filter (case-insensitive).

        Returns:
            The modified query with filters applied.
        """
        if basin is not None:
            query = query.where(Hurricane.basin == basin)
        if min_category is not None:
            query = query.where(Hurricane.category >= min_category)
        if is_active is not None:
            query = query.where(Hurricane.is_active == is_active)
        if start_date:
            query = query.where(Hurricane.advisory_time >= start_date)
        if end_date:
            query = query.where(Hurricane.advisory_time <= end_date)
        if name:
            query = query.where(Hurricane.name.ilike(f"%{name}%"))
        return query

    def get_hurricanes(
        self,
        basin: Optional[str] = None,
        min_category: Optional[int] = None,
        is_active: Optional[bool] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        name: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> HurricaneList:
        """Return a paginated, filtered list of hurricanes.

        Args:
            basin: Ocean basin code filter.
            min_category: Minimum Saffir-Simpson category.
            is_active: Active status filter.
            start_date: Earliest advisory time.
            end_date: Latest advisory time.
            name: Storm name substring (case-insensitive).
            page: Page number (1-based).
            per_page: Items per page.

        Returns:
            ``HurricaneList`` with serialised items and pagination metadata.
        """
        filter_kwargs = dict(
            basin=basin,
            min_category=min_category,
            is_active=is_active,
            start_date=start_date,
            end_date=end_date,
            name=name,
        )

        query = self._apply_filters(select(Hurricane), **filter_kwargs)
        count_query = self._apply_filters(
            select(func.count(Hurricane.id)), **filter_kwargs
        )

        total = db.session.execute(count_query).scalar() or 0
        offset = (page - 1) * per_page

        query = (
            query.order_by(Hurricane.advisory_time.desc())
            .offset(offset)
            .limit(per_page)
        )
        hurricanes = db.session.execute(query).scalars().all()

        items = [
            HurricaneResponse.from_orm_with_geometry(h) for h in hurricanes
        ]
        return HurricaneList(
            items=items, total=total, page=page, per_page=per_page
        )

    def get_by_id(self, hurricane_id: int) -> Optional[Hurricane]:
        """Fetch a single hurricane by primary key.

        Args:
            hurricane_id: Database primary key.

        Returns:
            The ``Hurricane`` instance or ``None``.
        """
        return db.session.execute(
            select(Hurricane).where(Hurricane.id == hurricane_id)
        ).scalar_one_or_none()

    def get_by_storm_id(self, storm_id: str) -> Optional[Hurricane]:
        """Fetch a single hurricane by its storm identifier.

        Args:
            storm_id: The NHC / NOAA storm ID.

        Returns:
            The ``Hurricane`` instance or ``None``.
        """
        return db.session.execute(
            select(Hurricane).where(Hurricane.storm_id == storm_id)
        ).scalar_one_or_none()

    def get_by_season(
        self,
        year: int,
        basin: Optional[str] = None,
    ) -> List[Hurricane]:
        """Return all hurricanes for a given season (year).

        Args:
            year: The calendar year.
            basin: Optional basin code filter.

        Returns:
            List of ``Hurricane`` instances ordered by advisory time.
        """
        start = datetime(year, 1, 1)
        end = datetime(year, 12, 31, 23, 59, 59)
        query = (
            select(Hurricane)
            .where(Hurricane.advisory_time >= start)
            .where(Hurricane.advisory_time <= end)
        )
        if basin:
            query = query.where(Hurricane.basin == basin)
        query = query.order_by(Hurricane.advisory_time.asc())
        return list(db.session.execute(query).scalars().all())

    def get_track(self, hurricane_id: int) -> Optional[dict]:
        """Return the track geometry as GeoJSON for a hurricane.

        Uses PostGIS ``ST_AsGeoJSON`` to serialise the track
        ``LINESTRING`` column.

        Args:
            hurricane_id: Database primary key.

        Returns:
            GeoJSON dict for the track or ``None``.
        """
        row = db.session.execute(
            select(ST_AsGeoJSON(Hurricane.track)).where(
                Hurricane.id == hurricane_id
            )
        ).scalar_one_or_none()

        if row is None:
            return None
        return json.loads(row)

    def create(self, data: dict) -> Hurricane:
        """Insert a new hurricane record.

        Args:
            data: Column values to populate the new row.

        Returns:
            The newly created ``Hurricane`` instance.
        """
        hurricane = Hurricane(**data)
        db.session.add(hurricane)
        db.session.flush()
        db.session.refresh(hurricane)
        return hurricane

    def upsert(self, data: dict) -> Hurricane:
        """Insert or update a hurricane keyed on ``storm_id``.

        Uses PostgreSQL ``ON CONFLICT DO UPDATE``.

        Args:
            data: Column values including ``storm_id``.

        Returns:
            The upserted ``Hurricane`` instance.
        """
        stmt = pg_insert(Hurricane).values(**data)
        stmt = stmt.on_conflict_do_update(
            index_elements=["storm_id"],
            set_={k: v for k, v in data.items() if k != "storm_id"},
        )
        db.session.execute(stmt)
        db.session.commit()
        return db.session.execute(
            select(Hurricane).where(Hurricane.storm_id == data["storm_id"])
        ).scalar_one()

    def get_active(self) -> List[Hurricane]:
        """Return all currently active hurricanes.

        Returns:
            List of active ``Hurricane`` instances ordered newest-first.
        """
        query = (
            select(Hurricane)
            .where(Hurricane.is_active.is_(True))
            .order_by(Hurricane.advisory_time.desc())
        )
        return list(db.session.execute(query).scalars().all())
