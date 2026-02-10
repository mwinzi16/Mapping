"""Earthquake parametric insurance analysis service.

Synchronous service.  Fetches historical earthquake data from the
USGS Historical Client and computes trigger-box statistics.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime
from typing import Dict, List, Optional

from app.schemas.earthquake_parametric import (
    EarthquakeBoundingBox,
    EarthquakeBoxStatistics,
    EarthquakeDatasetInfo,
    EarthquakeDatasetType,
    EarthquakeTriggerCriteria,
    HistoricalEarthquake,
)
from app.services.usgs_historical_client import USGSHistoricalClient

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Dataset metadata
# ------------------------------------------------------------------

EARTHQUAKE_DATASET_INFO: Dict[str, EarthquakeDatasetInfo] = {
    EarthquakeDatasetType.USGS_WORLDWIDE: EarthquakeDatasetInfo(
        id="usgs_worldwide",
        name="USGS Worldwide",
        description=(
            "USGS FDSNWS worldwide earthquake catalogue.  "
            "Covers all regions from 1970 to present."
        ),
        coverage="Global",
        year_range=(1970, 2024),
        source_url="https://earthquake.usgs.gov/fdsnws/event/1/",
    ),
    EarthquakeDatasetType.USGS_US: EarthquakeDatasetInfo(
        id="usgs_us",
        name="USGS United States",
        description=(
            "USGS FDSNWS earthquake catalogue filtered to the "
            "contiguous United States."
        ),
        coverage="CONUS (24°N–50°N, 125°W–66°W)",
        year_range=(1970, 2024),
        source_url="https://earthquake.usgs.gov/fdsnws/event/1/",
    ),
}


class EarthquakeParametricService:
    """Analyse historical earthquakes against trigger bounding boxes."""

    def __init__(self) -> None:
        self._usgs_client = USGSHistoricalClient()

    # ------------------------------------------------------------------
    # Dataset info
    # ------------------------------------------------------------------

    def get_available_datasets(self) -> Dict[str, EarthquakeDatasetInfo]:
        """Return metadata for all available earthquake datasets.

        Returns:
            Dict keyed by dataset identifier.
        """
        return EARTHQUAKE_DATASET_INFO

    # ------------------------------------------------------------------
    # Data retrieval
    # ------------------------------------------------------------------

    def get_historical_earthquakes(
        self,
        dataset: EarthquakeDatasetType = EarthquakeDatasetType.USGS_WORLDWIDE,
        start_year: int = 1980,
        end_year: int = 2024,
        min_magnitude: float = 4.0,
    ) -> List[HistoricalEarthquake]:
        """Fetch historical earthquakes from USGS.

        Args:
            dataset: Which dataset to query.
            start_year: First year of interest.
            end_year: Last year of interest.
            min_magnitude: Lower magnitude bound.

        Returns:
            List of ``HistoricalEarthquake`` objects.
        """
        region = (
            "us" if dataset == EarthquakeDatasetType.USGS_US else "worldwide"
        )

        raw = self._usgs_client.fetch_earthquakes(
            start_year=start_year,
            end_year=end_year,
            min_magnitude=min_magnitude,
            region=region,
        )

        earthquakes: List[HistoricalEarthquake] = []
        for eq in raw:
            try:
                event_time = eq.get("event_time", "")
                if isinstance(event_time, str):
                    event_time = datetime.fromisoformat(event_time)

                earthquakes.append(
                    HistoricalEarthquake(
                        event_id=eq.get("event_id", ""),
                        magnitude=eq.get("magnitude", 0),
                        magnitude_type=eq.get("magnitude_type"),
                        place=eq.get("place", "Unknown"),
                        event_time=event_time,
                        latitude=eq.get("latitude", 0),
                        longitude=eq.get("longitude", 0),
                        depth_km=eq.get("depth_km", 0),
                        significance=eq.get("significance", 0),
                        tsunami=eq.get("tsunami", 0),
                        url=eq.get("url"),
                    )
                )
            except Exception:
                logger.warning("Skipping unparseable earthquake: %s", eq)

        return earthquakes

    # ------------------------------------------------------------------
    # Box intersection
    # ------------------------------------------------------------------

    def find_earthquakes_in_box(
        self,
        earthquakes: List[HistoricalEarthquake],
        box: EarthquakeBoundingBox,
    ) -> List[HistoricalEarthquake]:
        """Filter earthquakes to those inside a bounding box.

        Args:
            earthquakes: Full earthquake list.
            box: Geographic bounding box.

        Returns:
            Earthquakes whose epicentres fall inside the box.
        """
        return [
            eq
            for eq in earthquakes
            if box.south <= eq.latitude <= box.north
            and box.west <= eq.longitude <= box.east
        ]

    def filter_by_trigger_criteria(
        self,
        earthquakes: List[HistoricalEarthquake],
        trigger: Optional[EarthquakeTriggerCriteria] = None,
    ) -> List[HistoricalEarthquake]:
        """Filter earthquakes by trigger criteria.

        Args:
            earthquakes: Earthquakes to test.
            trigger: Optional trigger criteria.

        Returns:
            Earthquakes that satisfy the criteria.
        """
        if trigger is None:
            return earthquakes

        return [
            eq
            for eq in earthquakes
            if trigger.matches(eq.magnitude, eq.depth_km)
        ]

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def calculate_box_statistics(
        self,
        earthquakes: List[HistoricalEarthquake],
        box: EarthquakeBoundingBox,
        start_year: int,
        end_year: int,
        trigger: Optional[EarthquakeTriggerCriteria] = None,
        dataset: str = "usgs_worldwide",
    ) -> EarthquakeBoxStatistics:
        """Compute statistics for earthquakes inside a single box.

        Args:
            earthquakes: Earthquakes already filtered to the box.
            box: The bounding box definition.
            start_year: First year analysed.
            end_year: Last year analysed.
            trigger: Optional trigger criteria.
            dataset: Dataset identifier.

        Returns:
            ``EarthquakeBoxStatistics`` for the box.
        """
        years_analyzed = end_year - start_year + 1
        total = len(earthquakes)

        qualifying = self.filter_by_trigger_criteria(earthquakes, trigger)
        qualifying_count = len(qualifying)

        annual_freq = total / years_analyzed if years_analyzed else 0.0
        qual_freq = (
            qualifying_count / years_analyzed if years_analyzed else 0.0
        )

        # Magnitude distribution (binned by whole number)
        mag_dist: Dict[str, int] = {}
        depth_dist: Dict[str, int] = {}
        monthly_dist: Dict[int, int] = {}
        magnitudes: List[float] = []
        depths: List[float] = []

        for eq in earthquakes:
            # Magnitude bins
            mag_bin = f"{int(eq.magnitude)}-{int(eq.magnitude) + 1}"
            mag_dist[mag_bin] = mag_dist.get(mag_bin, 0) + 1

            # Depth bins (0-50, 50-100, 100-200, 200+)
            if eq.depth_km < 50:
                d_bin = "0-50"
            elif eq.depth_km < 100:
                d_bin = "50-100"
            elif eq.depth_km < 200:
                d_bin = "100-200"
            else:
                d_bin = "200+"
            depth_dist[d_bin] = depth_dist.get(d_bin, 0) + 1

            # Monthly
            month = eq.event_time.month
            monthly_dist[month] = monthly_dist.get(month, 0) + 1

            magnitudes.append(eq.magnitude)
            depths.append(eq.depth_km)

        avg_mag = sum(magnitudes) / len(magnitudes) if magnitudes else 0.0
        max_mag = max(magnitudes) if magnitudes else 0.0
        avg_depth = sum(depths) / len(depths) if depths else 0.0
        shallowest = min(depths) if depths else 0.0

        # Poisson: P(≥1) = 1 - e^(-λ)
        trigger_prob = 1 - math.exp(-qual_freq) if qual_freq else 0.0

        return EarthquakeBoxStatistics(
            box_id=box.id,
            box_name=box.name,
            total_earthquakes=total,
            qualifying_earthquakes=qualifying_count,
            years_analyzed=years_analyzed,
            annual_frequency=round(annual_freq, 4),
            qualifying_annual_frequency=round(qual_freq, 4),
            magnitude_distribution=mag_dist,
            depth_distribution=depth_dist,
            monthly_distribution=monthly_dist,
            average_magnitude=round(avg_mag, 2),
            max_magnitude=round(max_mag, 2),
            average_depth_km=round(avg_depth, 1),
            shallowest_depth_km=round(shallowest, 1),
            trigger_probability=round(trigger_prob, 4),
            trigger_criteria=trigger,
            dataset=dataset,
        )

    def calculate_statistics(
        self,
        box: EarthquakeBoundingBox,
        all_earthquakes: List[HistoricalEarthquake],
        start_year: int = 1980,
        end_year: int = 2024,
        dataset: str = "usgs_worldwide",
    ) -> EarthquakeBoxStatistics:
        """Filter earthquakes to a box and compute statistics.

        Args:
            box: Bounding box definition.
            all_earthquakes: Full earthquake dataset.
            start_year: First year.
            end_year: Last year.
            dataset: Dataset identifier.

        Returns:
            ``EarthquakeBoxStatistics`` for the box.
        """
        in_box = self.find_earthquakes_in_box(all_earthquakes, box)
        return self.calculate_box_statistics(
            in_box,
            box,
            start_year,
            end_year,
            trigger=box.trigger,
            dataset=dataset,
        )

    def calculate_all_statistics(
        self,
        boxes: List[EarthquakeBoundingBox],
        all_earthquakes: List[HistoricalEarthquake],
        start_year: int = 1980,
        end_year: int = 2024,
        dataset: str = "usgs_worldwide",
    ) -> List[EarthquakeBoxStatistics]:
        """Compute statistics for multiple boxes.

        Args:
            boxes: List of bounding boxes.
            all_earthquakes: Full earthquake dataset.
            start_year: First year.
            end_year: Last year.
            dataset: Dataset identifier.

        Returns:
            List of ``EarthquakeBoxStatistics``, one per box.
        """
        return [
            self.calculate_statistics(
                box, all_earthquakes, start_year, end_year, dataset
            )
            for box in boxes
        ]
