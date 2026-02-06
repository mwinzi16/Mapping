"""
Service for earthquake parametric insurance analysis.
Handles box intersection calculations and statistical analysis.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.schemas.earthquake_parametric import (
    EarthquakeBoundingBox,
    EarthquakeBoxStatistics,
    EarthquakeDatasetType,
    EarthquakeTriggerCriteria,
    EarthquakeDatasetInfo,
)
from app.services.usgs_historical_client import get_usgs_historical_client


# Dataset metadata
EARTHQUAKE_DATASET_INFO: Dict[str, EarthquakeDatasetInfo] = {
    "usgs_worldwide": EarthquakeDatasetInfo(
        id="usgs_worldwide",
        name="USGS Worldwide",
        description="USGS Comprehensive Earthquake Catalog - Global coverage of M4+ events",
        coverage="Worldwide",
        year_range=(1970, 2024),
        source_url="https://earthquake.usgs.gov/earthquakes/search/"
    ),
    "usgs_us": EarthquakeDatasetInfo(
        id="usgs_us",
        name="USGS United States",
        description="USGS Earthquake Catalog - Continental US coverage with better depth data",
        coverage="Continental United States",
        year_range=(1970, 2024),
        source_url="https://earthquake.usgs.gov/earthquakes/search/"
    ),
}


class EarthquakeParametricService:
    """Service for analyzing earthquake data against trigger boxes."""
    
    def __init__(self):
        self.usgs = get_usgs_historical_client()
    
    def get_available_datasets(self) -> List[EarthquakeDatasetInfo]:
        """Return list of available earthquake datasets."""
        return list(EARTHQUAKE_DATASET_INFO.values())
    
    async def get_historical_earthquakes(
        self,
        start_year: int = 1980,
        end_year: int = 2024,
        min_magnitude: float = 4.0,
        dataset: EarthquakeDatasetType = EarthquakeDatasetType.USGS_WORLDWIDE
    ) -> List[Dict[str, Any]]:
        """Fetch historical earthquakes with filters."""
        region = "us" if dataset == EarthquakeDatasetType.USGS_US else "worldwide"
        
        return await self.usgs.fetch_earthquakes(
            start_year=start_year,
            end_year=end_year,
            min_magnitude=min_magnitude,
            region=region
        )
    
    def find_earthquakes_in_box(
        self,
        earthquakes: List[Dict[str, Any]],
        box: EarthquakeBoundingBox
    ) -> List[Dict[str, Any]]:
        """Find all earthquakes that fall within a bounding box."""
        matching = []
        
        for eq in earthquakes:
            lat = eq.get("latitude", 0)
            lon = eq.get("longitude", 0)
            
            # Check if point is within box bounds
            if box.south <= lat <= box.north and box.west <= lon <= box.east:
                matching.append(eq)
        
        return matching
    
    def filter_by_trigger_criteria(
        self,
        earthquakes: List[Dict[str, Any]],
        trigger: EarthquakeTriggerCriteria
    ) -> List[Dict[str, Any]]:
        """Filter earthquakes by trigger criteria."""
        return [
            eq for eq in earthquakes
            if trigger.matches(
                magnitude=eq.get("magnitude", 0),
                depth_km=eq.get("depth_km", 0)
            )
        ]
    
    def calculate_box_statistics(
        self,
        earthquakes: List[Dict[str, Any]],
        box: EarthquakeBoundingBox,
        start_year: int,
        end_year: int,
        dataset: str = "usgs_worldwide"
    ) -> EarthquakeBoxStatistics:
        """Calculate comprehensive statistics for earthquakes in a box."""
        # Find earthquakes in this box
        box_earthquakes = self.find_earthquakes_in_box(earthquakes, box)
        
        # Filter by trigger criteria if defined
        qualifying = box_earthquakes
        if box.trigger:
            qualifying = self.filter_by_trigger_criteria(box_earthquakes, box.trigger)
        
        years_analyzed = end_year - start_year + 1
        total_count = len(box_earthquakes)
        qualifying_count = len(qualifying)
        
        # If no earthquakes found
        if total_count == 0:
            return EarthquakeBoxStatistics(
                box_id=box.id,
                box_name=box.name,
                total_earthquakes=0,
                qualifying_earthquakes=0,
                years_analyzed=years_analyzed,
                annual_frequency=0.0,
                qualifying_annual_frequency=0.0,
                magnitude_distribution={},
                depth_distribution={},
                monthly_distribution={i: 0 for i in range(1, 13)},
                average_magnitude=0.0,
                max_magnitude=0.0,
                average_depth_km=0.0,
                shallowest_depth_km=0.0,
                trigger_probability=0.0,
                trigger_criteria=box.trigger,
                dataset=dataset,
            )
        
        # Calculate distributions
        magnitude_dist: Dict[str, int] = defaultdict(int)
        depth_dist: Dict[str, int] = defaultdict(int)
        monthly_dist: Dict[int, int] = defaultdict(int)
        yearly_counts: Dict[int, int] = defaultdict(int)
        qualifying_yearly: Dict[int, int] = defaultdict(int)
        
        magnitudes = []
        depths = []
        
        for eq in box_earthquakes:
            mag = eq.get("magnitude", 0)
            depth = eq.get("depth_km", 0)
            event_time = eq.get("event_time", "")
            
            magnitudes.append(mag)
            depths.append(depth)
            
            # Magnitude distribution (binned)
            mag_bin = f"{int(mag)}-{int(mag)+1}"
            magnitude_dist[mag_bin] += 1
            
            # Depth distribution (binned)
            if depth < 10:
                depth_bin = "0-10 km (Shallow)"
            elif depth < 70:
                depth_bin = "10-70 km (Intermediate)"
            elif depth < 300:
                depth_bin = "70-300 km (Deep)"
            else:
                depth_bin = "300+ km (Very Deep)"
            depth_dist[depth_bin] += 1
            
            # Monthly and yearly
            try:
                if isinstance(event_time, str):
                    dt = datetime.fromisoformat(event_time.replace('Z', '+00:00'))
                else:
                    dt = event_time
                monthly_dist[dt.month] += 1
                yearly_counts[dt.year] += 1
            except:
                pass
        
        # Count qualifying earthquakes by year
        for eq in qualifying:
            event_time = eq.get("event_time", "")
            try:
                if isinstance(event_time, str):
                    dt = datetime.fromisoformat(event_time.replace('Z', '+00:00'))
                else:
                    dt = event_time
                qualifying_yearly[dt.year] += 1
            except:
                pass
        
        # Calculate annual frequency
        annual_frequency = total_count / years_analyzed
        qualifying_annual_frequency = qualifying_count / years_analyzed
        
        # Calculate trigger probability (Poisson)
        if qualifying_annual_frequency > 0:
            trigger_probability = 1 - math.exp(-qualifying_annual_frequency)
        else:
            trigger_probability = 0.0
        
        return EarthquakeBoxStatistics(
            box_id=box.id,
            box_name=box.name,
            total_earthquakes=total_count,
            qualifying_earthquakes=qualifying_count,
            years_analyzed=years_analyzed,
            annual_frequency=round(annual_frequency, 3),
            qualifying_annual_frequency=round(qualifying_annual_frequency, 3),
            magnitude_distribution=dict(magnitude_dist),
            depth_distribution=dict(depth_dist),
            monthly_distribution=dict(monthly_dist),
            average_magnitude=round(sum(magnitudes) / len(magnitudes), 2),
            max_magnitude=max(magnitudes),
            average_depth_km=round(sum(depths) / len(depths), 1),
            shallowest_depth_km=min(depths),
            trigger_probability=round(trigger_probability, 4),
            trigger_criteria=box.trigger,
            dataset=dataset,
        )
    
    async def calculate_statistics(
        self,
        box: EarthquakeBoundingBox,
        start_year: int = 1980,
        end_year: int = 2024,
        min_magnitude: float = 4.0,
        dataset: EarthquakeDatasetType = EarthquakeDatasetType.USGS_WORLDWIDE
    ) -> EarthquakeBoxStatistics:
        """Calculate statistics for a single box."""
        earthquakes = await self.get_historical_earthquakes(
            start_year=start_year,
            end_year=end_year,
            min_magnitude=min_magnitude,
            dataset=dataset,
        )
        
        return self.calculate_box_statistics(
            earthquakes=earthquakes,
            box=box,
            start_year=start_year,
            end_year=end_year,
            dataset=dataset.value,
        )
    
    async def calculate_all_statistics(
        self,
        boxes: List[EarthquakeBoundingBox],
        start_year: int = 1980,
        end_year: int = 2024,
        min_magnitude: float = 4.0,
        dataset: EarthquakeDatasetType = EarthquakeDatasetType.USGS_WORLDWIDE
    ) -> Dict[str, EarthquakeBoxStatistics]:
        """Calculate statistics for multiple boxes."""
        # Fetch all earthquakes once
        earthquakes = await self.get_historical_earthquakes(
            start_year=start_year,
            end_year=end_year,
            min_magnitude=min_magnitude,
            dataset=dataset,
        )
        
        results = {}
        for box in boxes:
            stats = self.calculate_box_statistics(
                earthquakes=earthquakes,
                box=box,
                start_year=start_year,
                end_year=end_year,
                dataset=dataset.value,
            )
            results[box.id] = stats
        
        return results


# Singleton instance
_service: Optional[EarthquakeParametricService] = None


def get_earthquake_parametric_service() -> EarthquakeParametricService:
    """Get or create the earthquake parametric service singleton."""
    global _service
    if _service is None:
        _service = EarthquakeParametricService()
    return _service
