"""Earthquake service — database operations for earthquake events.

Synchronous service using Flask-SQLAlchemy's ``db.session``.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.extensions import db
from app.models.earthquake import Earthquake
from app.schemas.earthquake import EarthquakeList, EarthquakeResponse


class EarthquakeService:
    """Service layer for earthquake CRUD and query operations."""

    @staticmethod
    def _apply_filters(
        query,  # noqa: ANN001
        *,
        min_magnitude: Optional[float] = None,
        max_magnitude: Optional[float] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ):
        """Apply optional magnitude / date filters to a SQLAlchemy query.

        Args:
            query: An existing ``select()`` statement.
            min_magnitude: Lower magnitude bound (inclusive).
            max_magnitude: Upper magnitude bound (inclusive).
            start_date: Earliest event time (inclusive).
            end_date: Latest event time (inclusive).

        Returns:
            The modified query with filters applied.
        """
        if min_magnitude is not None:
            query = query.where(Earthquake.magnitude >= min_magnitude)
        if max_magnitude is not None:
            query = query.where(Earthquake.magnitude <= max_magnitude)
        if start_date:
            query = query.where(Earthquake.event_time >= start_date)
        if end_date:
            query = query.where(Earthquake.event_time <= end_date)
        return query

    def get_earthquakes(
        self,
        min_magnitude: Optional[float] = None,
        max_magnitude: Optional[float] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> EarthquakeList:
        """Return a paginated, filtered list of earthquakes.

        Args:
            min_magnitude: Lower magnitude bound.
            max_magnitude: Upper magnitude bound.
            start_date: Earliest event time.
            end_date: Latest event time.
            page: Page number (1-based).
            per_page: Items per page.

        Returns:
            ``EarthquakeList`` containing serialised items and pagination
            metadata.
        """
        filter_kwargs = dict(
            min_magnitude=min_magnitude,
            max_magnitude=max_magnitude,
            start_date=start_date,
            end_date=end_date,
        )

        query = self._apply_filters(select(Earthquake), **filter_kwargs)
        count_query = self._apply_filters(
            select(func.count(Earthquake.id)), **filter_kwargs
        )

        total = db.session.execute(count_query).scalar() or 0
        offset = (page - 1) * per_page

        query = (
            query.order_by(Earthquake.event_time.desc())
            .offset(offset)
            .limit(per_page)
        )
        earthquakes = db.session.execute(query).scalars().all()

        items = [
            EarthquakeResponse.from_orm_with_geometry(eq) for eq in earthquakes
        ]
        return EarthquakeList(
            items=items, total=total, page=page, per_page=per_page
        )

    def get_by_id(self, earthquake_id: int) -> Optional[Earthquake]:
        """Fetch a single earthquake by primary key.

        Args:
            earthquake_id: Database primary key.

        Returns:
            The ``Earthquake`` instance or ``None``.
        """
        return db.session.execute(
            select(Earthquake).where(Earthquake.id == earthquake_id)
        ).scalar_one_or_none()

    def get_by_usgs_id(self, usgs_id: str) -> Optional[Earthquake]:
        """Fetch a single earthquake by its USGS identifier.

        Args:
            usgs_id: The USGS event ID string.

        Returns:
            The ``Earthquake`` instance or ``None``.
        """
        return db.session.execute(
            select(Earthquake).where(Earthquake.usgs_id == usgs_id)
        ).scalar_one_or_none()

    def create(self, data: dict) -> Earthquake:
        """Insert a new earthquake record.

        Args:
            data: Column values to populate the new row.

        Returns:
            The newly created ``Earthquake`` instance.
        """
        earthquake = Earthquake(**data)
        db.session.add(earthquake)
        db.session.flush()
        db.session.refresh(earthquake)
        return earthquake

    def upsert(self, data: dict) -> Earthquake:
        """Insert or update an earthquake keyed on ``usgs_id``.

        Uses PostgreSQL ``ON CONFLICT DO UPDATE`` to keep the record
        up-to-date without raising integrity errors.

        Args:
            data: Column values including ``usgs_id``.

        Returns:
            The upserted ``Earthquake`` instance.
        """
        stmt = pg_insert(Earthquake).values(**data)
        stmt = stmt.on_conflict_do_update(
            index_elements=["usgs_id"],
            set_={k: v for k, v in data.items() if k != "usgs_id"},
        )
        db.session.execute(stmt)
        db.session.commit()
        return db.session.execute(
            select(Earthquake).where(Earthquake.usgs_id == data["usgs_id"])
        ).scalar_one()

    def get_recent(
        self,
        hours: int = 24,
        min_magnitude: float = 2.5,
    ) -> List[Earthquake]:
        """Return recent earthquakes above a magnitude threshold.

        Args:
            hours: Look-back window in hours.
            min_magnitude: Minimum magnitude filter.

        Returns:
            List of ``Earthquake`` instances ordered newest-first.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        query = (
            select(Earthquake)
            .where(Earthquake.event_time >= cutoff)
            .where(Earthquake.magnitude >= min_magnitude)
            .order_by(Earthquake.event_time.desc())
        )
        return list(db.session.execute(query).scalars().all())
