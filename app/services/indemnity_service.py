"""Indemnity insurance — event significance scoring.

Pure functions with no framework dependencies.
"""
from __future__ import annotations

import math


def calculate_earthquake_significance(eq: dict) -> float:
    """Calculate a 0–100 significance score for an earthquake.

    The score is a weighted combination of magnitude, depth (shallower
    is more damaging), and the USGS significance metric.

    Args:
        eq: Dict with keys ``magnitude``, ``depth_km``, and optionally
            ``significance``.

    Returns:
        Normalised significance score between 0 and 100.
    """
    magnitude = float(eq.get("magnitude", 0))
    depth_km = float(eq.get("depth_km", 0))
    usgs_sig = float(eq.get("significance", 0))

    # Magnitude contribution (0-50 points)
    # Richter scale is logarithmic – exaggerate higher magnitudes.
    mag_score = min(50.0, (magnitude / 9.5) ** 2 * 50)

    # Depth contribution (0-25 points)
    # Shallow (<70 km) earthquakes are most destructive.
    if depth_km <= 0:
        depth_score = 25.0
    elif depth_km < 70:
        depth_score = 25.0 * (1 - depth_km / 70)
    elif depth_km < 300:
        depth_score = 10.0 * (1 - (depth_km - 70) / 230)
    else:
        depth_score = 0.0

    # USGS significance contribution (0-25 points)
    sig_score = min(25.0, (usgs_sig / 1000) * 25)

    total = mag_score + depth_score + sig_score
    return round(min(100.0, max(0.0, total)), 2)


def calculate_hurricane_significance(hurricane: dict) -> float:
    """Calculate a 0–100 significance score for a hurricane.

    The score is a weighted combination of category, max wind speed,
    and minimum central pressure.

    Args:
        hurricane: Dict with keys ``max_category`` (or ``category``),
            ``max_wind_mph``, and optionally ``min_pressure_mb``.

    Returns:
        Normalised significance score between 0 and 100.
    """
    category = int(
        hurricane.get("max_category", hurricane.get("category", 0)) or 0
    )
    wind_mph = float(hurricane.get("max_wind_mph", 0))
    pressure = hurricane.get("min_pressure_mb")

    # Category contribution (0-40 points)
    cat_score = min(40.0, (category / 5) * 40)

    # Wind contribution (0-35 points)
    # Category-5 threshold is ~157 mph.
    wind_score = min(35.0, (wind_mph / 180) * 35)

    # Pressure contribution (0-25 points)
    # Lower pressure = more intense.  Reference range: 870–1013 mb.
    if pressure is not None and pressure > 0:
        pressure_val = float(pressure)
        normalized = max(0.0, (1013 - pressure_val) / (1013 - 870))
        pressure_score = min(25.0, normalized * 25)
    else:
        pressure_score = 0.0

    total = cat_score + wind_score + pressure_score
    return round(min(100.0, max(0.0, total)), 2)
