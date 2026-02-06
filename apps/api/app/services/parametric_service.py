"""
Service for parametric insurance analysis.
Handles box intersection calculations and statistical analysis.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.parametric import (
    BoundingBox,
    BoxStatistics,
    DatasetType,
    TriggerCriteria,
    DatasetInfo,
)
from app.services.ibtracs_client import get_ibtracs_client
from app.services.hurdat2_client import get_hurdat2_client
from app.utils.weather import wind_to_category


# Dataset metadata
DATASET_INFO: Dict[str, DatasetInfo] = {
    "ibtracs": DatasetInfo(
        id="ibtracs",
        name="IBTrACS",
        description="International Best Track Archive for Climate Stewardship - global tropical cyclone data",
        basins=["NA", "EP", "WP", "NI", "SI", "SP"],
        year_range=(1980, 2024),
        source_url="https://www.ncei.noaa.gov/products/international-best-track-archive"
    ),
    "hurdat2_atlantic": DatasetInfo(
        id="hurdat2_atlantic",
        name="HURDAT2 Atlantic",
        description="NOAA Atlantic Hurricane Database - detailed Atlantic basin data since 1851",
        basins=["atlantic"],
        year_range=(1851, 2023),
        source_url="https://www.nhc.noaa.gov/data/#hurdat"
    ),
    "hurdat2_pacific": DatasetInfo(
        id="hurdat2_pacific",
        name="HURDAT2 Pacific",
        description="NOAA Northeast/Central Pacific Hurricane Database since 1949",
        basins=["pacific"],
        year_range=(1949, 2023),
        source_url="https://www.nhc.noaa.gov/data/#hurdat"
    ),
}


class ParametricAnalysisService:
    """Service for analyzing hurricane data against trigger boxes."""
    
    def __init__(self):
        self.ibtracs = get_ibtracs_client()
        self.hurdat2 = get_hurdat2_client()
    
    def get_available_datasets(self) -> List[DatasetInfo]:
        """Return list of available datasets."""
        return list(DATASET_INFO.values())
    
    async def get_historical_hurricanes(
        self,
        start_year: int = 1980,
        end_year: int = 2024,
        min_category: int = 0,
        basin: Optional[str] = None,
        dataset: DatasetType = DatasetType.IBTRACS
    ) -> List[Dict[str, Any]]:
        """Fetch historical hurricanes with filters from specified dataset."""
        if dataset == DatasetType.HURDAT2_ATLANTIC:
            return await self.hurdat2.fetch_hurricanes(
                start_year=start_year,
                end_year=end_year,
                min_category=min_category,
                basin="atlantic"
            )
        elif dataset == DatasetType.HURDAT2_PACIFIC:
            return await self.hurdat2.fetch_hurricanes(
                start_year=start_year,
                end_year=end_year,
                min_category=min_category,
                basin="pacific"
            )
        else:
            # Default to IBTrACS
            return await self.ibtracs.fetch_hurricanes(
                start_year=start_year,
                end_year=end_year,
                min_category=min_category,
                basin=basin
            )
    
    def find_box_intersections(
        self,
        hurricanes: List[Dict[str, Any]],
        box: BoundingBox
    ) -> List[Dict[str, Any]]:
        """
        Find all hurricanes that intersect with a bounding box.
        Returns hurricanes with intersection details.
        """
        intersecting = []
        
        for hurricane in hurricanes:
            track = hurricane.get("track", [])
            intersection = self._check_track_intersection(track, box)
            
            if intersection:
                entry_point, exit_point, max_intensity, max_pressure = intersection
                category_at_crossing = wind_to_category(max_intensity)
                
                intersecting.append({
                    "hurricane": hurricane,
                    "entry_point": entry_point,
                    "exit_point": exit_point,
                    "max_intensity_in_box": max_intensity,
                    "min_pressure_in_box": max_pressure,
                    "category_at_crossing": category_at_crossing,
                })
        
        return intersecting
    
    def filter_by_trigger_criteria(
        self,
        intersections: List[Dict[str, Any]],
        trigger: Optional[TriggerCriteria]
    ) -> List[Dict[str, Any]]:
        """
        Filter intersections by trigger criteria.
        Returns only intersections that meet the trigger criteria.
        """
        if trigger is None:
            return intersections
        
        qualifying = []
        for intersection in intersections:
            category = intersection.get("category_at_crossing", 0)
            wind = intersection.get("max_intensity_in_box", 0)
            pressure = intersection.get("min_pressure_in_box")
            
            if trigger.matches(category=category, wind_knots=wind, pressure_mb=pressure):
                qualifying.append(intersection)
        
        return qualifying
    
    def _check_track_intersection(
        self,
        track: List[Dict[str, Any]],
        box: BoundingBox
    ) -> Optional[Tuple[Dict, Optional[Dict], int, Optional[int]]]:
        """
        Check if a hurricane track intersects with a bounding box.
        Returns (entry_point, exit_point, max_intensity_in_box, min_pressure_in_box) or None.
        """
        entry_point = None
        exit_point = None
        max_intensity = 0
        min_pressure: Optional[int] = None
        was_inside = False
        
        for i, point in enumerate(track):
            lat = point.get("latitude", 0)
            lon = point.get("longitude", 0)
            
            is_inside = self._point_in_box(lat, lon, box)
            
            if is_inside:
                wind = point.get("wind_knots", 0)
                pressure = point.get("pressure_mb")
                
                if wind > max_intensity:
                    max_intensity = wind
                
                if pressure is not None:
                    if min_pressure is None or pressure < min_pressure:
                        min_pressure = pressure
                
                if not was_inside:
                    # Just entered the box
                    entry_point = point
                    was_inside = True
            else:
                if was_inside:
                    # Just exited the box
                    exit_point = point
                    was_inside = False
        
        if entry_point:
            return (entry_point, exit_point, max_intensity, min_pressure)
        
        # Check for line segment intersections (track crosses box without a point inside)
        for i in range(len(track) - 1):
            p1 = track[i]
            p2 = track[i + 1]
            
            if self._segment_intersects_box(
                p1["latitude"], p1["longitude"],
                p2["latitude"], p2["longitude"],
                box
            ):
                # Interpolate entry point
                max_wind = max(p1.get("wind_knots", 0), p2.get("wind_knots", 0))
                p1_pressure = p1.get("pressure_mb")
                p2_pressure = p2.get("pressure_mb")
                seg_min_pressure = None
                if p1_pressure is not None and p2_pressure is not None:
                    seg_min_pressure = min(p1_pressure, p2_pressure)
                elif p1_pressure is not None:
                    seg_min_pressure = p1_pressure
                elif p2_pressure is not None:
                    seg_min_pressure = p2_pressure
                return (p1, p2, max_wind, seg_min_pressure)
        
        return None
    
    def _point_in_box(self, lat: float, lon: float, box: BoundingBox) -> bool:
        """Check if a point is inside a bounding box."""
        return (
            box.south <= lat <= box.north and
            box.west <= lon <= box.east
        )
    
    def _segment_intersects_box(
        self,
        lat1: float, lon1: float,
        lat2: float, lon2: float,
        box: BoundingBox
    ) -> bool:
        """Check if a line segment intersects a bounding box."""
        # Check if segment crosses any of the four box edges
        edges = [
            # Top edge
            (box.west, box.north, box.east, box.north),
            # Bottom edge
            (box.west, box.south, box.east, box.south),
            # Left edge
            (box.west, box.south, box.west, box.north),
            # Right edge
            (box.east, box.south, box.east, box.north),
        ]
        
        for edge in edges:
            if self._segments_intersect(
                lon1, lat1, lon2, lat2,
                edge[0], edge[1], edge[2], edge[3]
            ):
                return True
        
        return False
    
    @staticmethod
    def _segments_intersect(
        x1: float, y1: float, x2: float, y2: float,
        x3: float, y3: float, x4: float, y4: float
    ) -> bool:
        """Check if two line segments intersect."""
        def ccw(ax, ay, bx, by, cx, cy):
            return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax)
        
        return (
            ccw(x1, y1, x3, y3, x4, y4) != ccw(x2, y2, x3, y3, x4, y4) and
            ccw(x1, y1, x2, y2, x3, y3) != ccw(x1, y1, x2, y2, x4, y4)
        )
    
    def calculate_statistics(
        self,
        intersections: List[Dict[str, Any]],
        box: BoundingBox,
        start_year: int,
        end_year: int,
        dataset: DatasetType = DatasetType.IBTRACS
    ) -> BoxStatistics:
        """
        Calculate statistical analysis for a trigger box.
        Filters by trigger criteria if box has one defined.
        """
        years_analyzed = end_year - start_year + 1
        total_hurricanes = len(intersections)
        
        # Filter by trigger criteria if defined
        qualifying = self.filter_by_trigger_criteria(intersections, box.trigger)
        qualifying_hurricanes = len(qualifying)
        
        # Category distribution (all intersecting hurricanes)
        category_dist: Dict[int, int] = defaultdict(int)
        for intersection in intersections:
            cat = intersection.get("category_at_crossing", 0)
            category_dist[cat] += 1
        
        # Monthly distribution (all intersecting hurricanes)
        monthly_dist: Dict[int, int] = defaultdict(int)
        for intersection in intersections:
            entry = intersection.get("entry_point", {})
            timestamp_str = entry.get("timestamp", "")
            if timestamp_str:
                try:
                    dt = datetime.fromisoformat(timestamp_str)
                    monthly_dist[dt.month] += 1
                except ValueError:
                    pass
        
        # Intensity statistics (all intersecting hurricanes)
        intensities = [
            intersection.get("max_intensity_in_box", 0)
            for intersection in intersections
        ]
        
        avg_intensity = sum(intensities) / len(intensities) if intensities else 0
        max_intensity = max(intensities) if intensities else 0
        
        # Annual frequency (of qualifying events)
        annual_frequency = total_hurricanes / years_analyzed if years_analyzed > 0 else 0
        qualifying_annual_frequency = qualifying_hurricanes / years_analyzed if years_analyzed > 0 else 0
        
        # Trigger probability (probability of at least one qualifying event per year)
        # Using Poisson distribution: P(X >= 1) = 1 - P(X = 0) = 1 - e^(-λ)
        trigger_probability = 1 - math.exp(-qualifying_annual_frequency) if qualifying_annual_frequency > 0 else 0
        
        return BoxStatistics(
            box_id=box.id,
            box_name=box.name,
            total_hurricanes=total_hurricanes,
            qualifying_hurricanes=qualifying_hurricanes,
            years_analyzed=years_analyzed,
            annual_frequency=annual_frequency,
            qualifying_annual_frequency=qualifying_annual_frequency,
            category_distribution=dict(category_dist),
            monthly_distribution=dict(monthly_dist),
            average_intensity_knots=avg_intensity,
            max_intensity_knots=max_intensity,
            trigger_probability=trigger_probability,
            trigger_criteria=box.trigger,
            dataset=dataset.value,
        )
    
    async def analyze_box(
        self,
        box: BoundingBox,
        start_year: int = 1980,
        end_year: int = 2024,
        min_category: int = 0,
        basin: Optional[str] = None,
        dataset: DatasetType = DatasetType.IBTRACS
    ) -> BoxStatistics:
        """
        Perform complete analysis for a single box.
        """
        hurricanes = await self.get_historical_hurricanes(
            start_year=start_year,
            end_year=end_year,
            min_category=min_category,
            basin=basin,
            dataset=dataset
        )
        
        intersections = self.find_box_intersections(hurricanes, box)
        
        return self.calculate_statistics(
            intersections=intersections,
            box=box,
            start_year=start_year,
            end_year=end_year,
            dataset=dataset
        )
    
    async def analyze_multiple_boxes(
        self,
        boxes: List[BoundingBox],
        start_year: int = 1980,
        end_year: int = 2024,
        min_category: int = 0,
        basin: Optional[str] = None,
        dataset: DatasetType = DatasetType.IBTRACS
    ) -> Dict[str, BoxStatistics]:
        """
        Analyze multiple boxes efficiently (fetches hurricane data once).
        """
        hurricanes = await self.get_historical_hurricanes(
            start_year=start_year,
            end_year=end_year,
            min_category=min_category,
            basin=basin,
            dataset=dataset
        )
        
        results = {}
        for box in boxes:
            intersections = self.find_box_intersections(hurricanes, box)
            stats = self.calculate_statistics(
                intersections=intersections,
                box=box,
                start_year=start_year,
                end_year=end_year,
                dataset=dataset
            )
            results[box.id] = stats
        
        return results
    

# Singleton instance
_service: Optional[ParametricAnalysisService] = None


def get_parametric_service() -> ParametricAnalysisService:
    """Get or create the parametric analysis service singleton."""
    global _service
    if _service is None:
        _service = ParametricAnalysisService()
    return _service
