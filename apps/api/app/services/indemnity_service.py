"""Business-logic helpers for indemnity historical event scoring."""
from __future__ import annotations


def calculate_earthquake_significance(eq: dict) -> float:
    """Calculate significance score for an earthquake.

    Based on magnitude (exponential scale) and damage if available.

    Args:
        eq: Dictionary with earthquake data.

    Returns:
        A float significance score.
    """
    magnitude = eq.get("magnitude", 0)
    damage = eq.get("damage_usd", 0) or 0

    # Magnitude contributes exponentially (Richter scale is logarithmic)
    mag_score = 10 ** (magnitude - 4)  # Normalize so M4 = 1, M5 = 10, M6 = 100, etc.

    # Damage contributes linearly (normalized to billions)
    damage_score = damage / 1_000_000_000 if damage > 0 else 0

    # Combined score (magnitude is primary, damage is secondary)
    return mag_score + (damage_score * 10)


def calculate_hurricane_significance(hurricane: dict) -> float:
    """Calculate significance score for a hurricane.

    Based on category, wind speed, and damage if available.

    Args:
        hurricane: Dictionary with hurricane data.

    Returns:
        A float significance score.
    """
    category = hurricane.get("max_category", 0)
    wind = hurricane.get("max_wind_knots", 0) or hurricane.get("max_wind_mph", 0)
    damage = hurricane.get("damage_usd", 0) or 0

    # Category contributes exponentially
    cat_score = 2**category if category > 0 else 0.5

    # Wind speed normalized (100 knots = 1.0)
    wind_score = wind / 100

    # Damage in billions
    damage_score = damage / 1_000_000_000 if damage > 0 else 0

    # Combined score
    return (cat_score * 10) + (wind_score * 5) + (damage_score * 2)
