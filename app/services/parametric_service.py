"""Parametric insurance analysis service — hurricane trigger box analysis.

Synchronous service.  Fetches historical hurricane tracks from IBTrACS
or HURDAT2 and computes intersection / trigger statistics for user-
defined bounding boxes.
"""
from __future__ import annotations

import logging
import math
from typing import Dict, List, Optional, Tuple

from app.schemas.parametric import (
    BoundingBox,
    BoxIntersection,
    BoxStatistics,
    DatasetInfo,
    DatasetType,
    HistoricalHurricane,
    HistoricalHurricaneSummary,
    HurricaneTrackPoint,
    TriggerCriteria,
)
from app.services.ibtracs_client import IBTrACSClient
from app.services.hurdat2_client import HURDAT2Client

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Dataset metadata
# ------------------------------------------------------------------

DATASET_INFO: Dict[str, DatasetInfo] = {
    DatasetType.IBTRACS: DatasetInfo(
        id="ibtracs",
        name="IBTrACS (International Best Track Archive)",
        description=(
            "Global tropical cyclone best track data from NOAA NCEI.  "
            "Covers all ocean basins from 1842 to present."
        ),
        basins=[
            "NA",
            "SA",
            "EP",
            "WP",
            "SP",
            "SI",
            "NI",
            "ALL",
        ],
        year_range=(1842, 2024),
        source_url=(
            "https://www.ncei.noaa.gov/products/"
            "international-best-track-archive"
        ),
    ),
    DatasetType.HURDAT2_ATLANTIC: DatasetInfo(
        id="hurdat2_atlantic",
        name="HURDAT2 Atlantic",
        description="NHC Atlantic hurricane database (HURDAT2 format).",
        basins=["AL"],
        year_range=(1851, 2024),
        source_url="https://www.nhc.noaa.gov/data/#hurdat",
    ),
    DatasetType.HURDAT2_PACIFIC: DatasetInfo(
        id="hurdat2_pacific",
        name="HURDAT2 East Pacific",
        description="NHC East / Central Pacific hurricane database.",
        basins=["EP", "CP"],
        year_range=(1949, 2024),
        source_url="https://www.nhc.noaa.gov/data/#hurdat",
    ),
}


class ParametricService:
    """Analyse historical hurricane tracks against trigger bounding boxes."""

    def __init__(self) -> None:
        self._ibtracs = IBTrACSClient()
        self._hurdat2 = HURDAT2Client()

    # ------------------------------------------------------------------
    # Data retrieval
    # ------------------------------------------------------------------

    def get_historical_hurricanes(
        self,
        dataset: DatasetType = DatasetType.IBTRACS,
        basin: Optional[str] = None,
        start_year: int = 1980,
        end_year: int = 2024,
    ) -> List[HistoricalHurricane]:
        """Fetch historical hurricanes from the chosen dataset.

        Args:
            dataset: Which data source to query.
            basin: Ocean basin code filter.
            start_year: First year of interest.
            end_year: Last year of interest.

        Returns:
            List of ``HistoricalHurricane`` objects with full tracks.
        """
        if dataset == DatasetType.IBTRACS:
            return self._ibtracs.fetch_hurricanes(
                basin=basin or "ALL",
                start_year=start_year,
                end_year=end_year,
            )
        if dataset == DatasetType.HURDAT2_ATLANTIC:
            return self._hurdat2.fetch_hurricanes(
                basin="atlantic",
                start_year=start_year,
                end_year=end_year,
            )
        if dataset == DatasetType.HURDAT2_PACIFIC:
            return self._hurdat2.fetch_hurricanes(
                basin="pacific",
                start_year=start_year,
                end_year=end_year,
            )
        return []

    # ------------------------------------------------------------------
    # Box intersection
    # ------------------------------------------------------------------

    def find_box_intersections(
        self,
        hurricanes: List[HistoricalHurricane],
        box: BoundingBox,
    ) -> List[BoxIntersection]:
        """Find hurricanes whose tracks pass through a bounding box.

        Args:
            hurricanes: Full hurricane tracks to test.
            box: The geographic bounding box.

        Returns:
            List of ``BoxIntersection`` records for qualifying storms.
        """
        intersections: List[BoxIntersection] = []

        for hurricane in hurricanes:
            result = self._check_track_intersection(hurricane, box)
            if result is not None:
                intersections.append(result)

        return intersections

    def filter_by_trigger_criteria(
        self,
        intersections: List[BoxIntersection],
        trigger: Optional[TriggerCriteria] = None,
    ) -> List[BoxIntersection]:
        """Filter intersections by optional trigger criteria.

        Args:
            intersections: Box crossings to filter.
            trigger: Trigger criteria (category / wind / pressure).

        Returns:
            Intersections satisfying the criteria.
        """
        if trigger is None:
            return intersections

        return [
            ix
            for ix in intersections
            if trigger.matches(
                category=ix.category_at_crossing,
                wind_knots=ix.entry_point.wind_knots,
                pressure_mb=ix.entry_point.pressure_mb,
            )
        ]

    # ------------------------------------------------------------------
    # Track / box geometry helpers
    # ------------------------------------------------------------------

    def _check_track_intersection(
        self,
        hurricane: HistoricalHurricane,
        box: BoundingBox,
    ) -> Optional[BoxIntersection]:
        """Test whether a hurricane track enters a bounding box.

        Args:
            hurricane: A single historical hurricane with track points.
            box: The bounding box to test.

        Returns:
            ``BoxIntersection`` if the track enters the box, else ``None``.
        """
        entry_point: Optional[HurricaneTrackPoint] = None
        exit_point: Optional[HurricaneTrackPoint] = None
        max_intensity_in_box = 0

        for i, pt in enumerate(hurricane.track):
            inside = self._point_in_box(pt.latitude, pt.longitude, box)

            if inside and entry_point is None:
                entry_point = pt
            elif inside:
                max_intensity_in_box = max(
                    max_intensity_in_box, pt.wind_knots
                )
            elif entry_point is not None and not inside:
                exit_point = hurricane.track[i - 1] if i > 0 else None
                break

            # Check segment intersections for storms that pass through
            # without a track point landing inside the box.
            if (
                entry_point is None
                and i > 0
                and self._segment_intersects_box(
                    hurricane.track[i - 1].latitude,
                    hurricane.track[i - 1].longitude,
                    pt.latitude,
                    pt.longitude,
                    box,
                )
            ):
                entry_point = pt

        if entry_point is None:
            return None

        max_intensity_in_box = max(
            max_intensity_in_box, entry_point.wind_knots
        )

        summary = HistoricalHurricaneSummary(
            storm_id=hurricane.storm_id,
            name=hurricane.name,
            year=hurricane.year,
            basin=hurricane.basin,
            max_category=hurricane.max_category,
            max_wind_knots=hurricane.max_wind_knots,
            min_pressure_mb=hurricane.min_pressure_mb,
            start_date=hurricane.start_date,
            end_date=hurricane.end_date,
        )

        return BoxIntersection(
            box_id=box.id,
            hurricane=summary,
            entry_point=entry_point,
            exit_point=exit_point,
            max_intensity_in_box=max_intensity_in_box,
            category_at_crossing=entry_point.category,
        )

    @staticmethod
    def _point_in_box(
        lat: float,
        lon: float,
        box: BoundingBox,
    ) -> bool:
        """Return ``True`` if a point lies within the bounding box.

        Args:
            lat: Latitude of the point.
            lon: Longitude of the point.
            box: The bounding box.

        Returns:
            Whether the point is inside the box.
        """
        return box.south <= lat <= box.north and box.west <= lon <= box.east

    @staticmethod
    def _segment_intersects_box(
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float,
        box: BoundingBox,
    ) -> bool:
        """Check if a line segment intersects any edge of the box.

        Uses a simple segment-vs-segment intersection test for each of
        the four box edges.

        Args:
            lat1: Start latitude.
            lon1: Start longitude.
            lat2: End latitude.
            lon2: End longitude.
            box: The bounding box.

        Returns:
            ``True`` when the segment crosses a box edge.
        """
        edges: List[Tuple[float, float, float, float]] = [
            (box.south, box.west, box.south, box.east),  # bottom
            (box.north, box.west, box.north, box.east),  # top
            (box.south, box.west, box.north, box.west),  # left
            (box.south, box.east, box.north, box.east),  # right
        ]
        for elat1, elon1, elat2, elon2 in edges:
            if _segments_intersect(
                lat1, lon1, lat2, lon2, elat1, elon1, elat2, elon2
            ):
                return True
        return False

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def calculate_statistics(
        self,
        intersections: List[BoxIntersection],
        box: BoundingBox,
        start_year: int,
        end_year: int,
        trigger: Optional[TriggerCriteria] = None,
        dataset: str = "ibtracs",
    ) -> BoxStatistics:
        """Compute statistics for a single bounding box.

        Args:
            intersections: All intersections for the box.
            box: The bounding box definition.
            start_year: First year analysed.
            end_year: Last year analysed.
            trigger: Optional trigger criteria for qualifying subset.
            dataset: Dataset identifier string.

        Returns:
            ``BoxStatistics`` summary.
        """
        years_analyzed = end_year - start_year + 1
        total = len(intersections)

        qualifying = self.filter_by_trigger_criteria(intersections, trigger)
        qualifying_count = len(qualifying)

        annual_freq = total / years_analyzed if years_analyzed else 0.0
        qualifying_freq = (
            qualifying_count / years_analyzed if years_analyzed else 0.0
        )

        # Category distribution
        cat_dist: Dict[int, int] = {}
        monthly_dist: Dict[int, int] = {}
        wind_values: List[int] = []

        for ix in intersections:
            cat = ix.category_at_crossing
            cat_dist[cat] = cat_dist.get(cat, 0) + 1

            month = ix.entry_point.timestamp.month
            monthly_dist[month] = monthly_dist.get(month, 0) + 1

            wind_values.append(ix.max_intensity_in_box)

        avg_wind = sum(wind_values) / len(wind_values) if wind_values else 0.0
        max_wind = max(wind_values) if wind_values else 0

        # Poisson probability of ≥1 event per year
        trigger_prob = 1 - math.exp(-qualifying_freq) if qualifying_freq else 0.0

        return BoxStatistics(
            box_id=box.id,
            box_name=box.name,
            total_hurricanes=total,
            qualifying_hurricanes=qualifying_count,
            years_analyzed=years_analyzed,
            annual_frequency=round(annual_freq, 4),
            qualifying_annual_frequency=round(qualifying_freq, 4),
            category_distribution=cat_dist,
            monthly_distribution=monthly_dist,
            average_intensity_knots=round(avg_wind, 1),
            max_intensity_knots=max_wind,
            trigger_probability=round(trigger_prob, 4),
            trigger_criteria=trigger,
            dataset=dataset,
        )

    def analyze_box(
        self,
        box: BoundingBox,
        hurricanes: List[HistoricalHurricane],
        start_year: int = 1980,
        end_year: int = 2024,
        dataset: str = "ibtracs",
    ) -> BoxStatistics:
        """Run full analysis for a single bounding box.

        Args:
            box: The bounding box to analyse.
            hurricanes: Historical hurricane dataset.
            start_year: First year.
            end_year: Last year.
            dataset: Dataset identifier.

        Returns:
            ``BoxStatistics`` for the box.
        """
        intersections = self.find_box_intersections(hurricanes, box)
        return self.calculate_statistics(
            intersections,
            box,
            start_year,
            end_year,
            trigger=box.trigger,
            dataset=dataset,
        )

    def analyze_multiple_boxes(
        self,
        boxes: List[BoundingBox],
        hurricanes: List[HistoricalHurricane],
        start_year: int = 1980,
        end_year: int = 2024,
        dataset: str = "ibtracs",
    ) -> List[BoxStatistics]:
        """Analyse multiple boxes against the same hurricane dataset.

        Args:
            boxes: List of bounding boxes.
            hurricanes: Historical hurricane dataset.
            start_year: First year.
            end_year: Last year.
            dataset: Dataset identifier.

        Returns:
            List of ``BoxStatistics``, one per box.
        """
        return [
            self.analyze_box(box, hurricanes, start_year, end_year, dataset)
            for box in boxes
        ]


# ------------------------------------------------------------------
# Segment intersection helper (module-level)
# ------------------------------------------------------------------


def _segments_intersect(
    p1_lat: float,
    p1_lon: float,
    p2_lat: float,
    p2_lon: float,
    p3_lat: float,
    p3_lon: float,
    p4_lat: float,
    p4_lon: float,
) -> bool:
    """Test whether two line segments intersect (2-D cross-product method).

    Segment A: (p1) → (p2), Segment B: (p3) → (p4).

    Args:
        p1_lat: Latitude of A start.
        p1_lon: Longitude of A start.
        p2_lat: Latitude of A end.
        p2_lon: Longitude of A end.
        p3_lat: Latitude of B start.
        p3_lon: Longitude of B start.
        p4_lat: Latitude of B end.
        p4_lon: Longitude of B end.

    Returns:
        ``True`` when the segments cross.
    """

    def _cross(
        o_lat: float,
        o_lon: float,
        a_lat: float,
        a_lon: float,
        b_lat: float,
        b_lon: float,
    ) -> float:
        return (a_lat - o_lat) * (b_lon - o_lon) - (a_lon - o_lon) * (
            b_lat - o_lat
        )

    d1 = _cross(p3_lat, p3_lon, p4_lat, p4_lon, p1_lat, p1_lon)
    d2 = _cross(p3_lat, p3_lon, p4_lat, p4_lon, p2_lat, p2_lon)
    d3 = _cross(p1_lat, p1_lon, p2_lat, p2_lon, p3_lat, p3_lon)
    d4 = _cross(p1_lat, p1_lon, p2_lat, p2_lon, p4_lat, p4_lon)

    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and (
        (d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)
    ):
        return True

    return False
