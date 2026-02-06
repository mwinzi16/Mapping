"""Weather-related utility functions shared across services."""
from __future__ import annotations


def wind_to_category(wind_knots: int) -> int:
    """Convert wind speed in knots to Saffir-Simpson Hurricane Wind Scale category.

    Args:
        wind_knots: Maximum sustained wind speed in knots.

    Returns:
        Integer category 0–5 where 0 means Tropical Storm or lower.
    """
    if wind_knots >= 137:
        return 5
    if wind_knots >= 113:
        return 4
    if wind_knots >= 96:
        return 3
    if wind_knots >= 83:
        return 2
    if wind_knots >= 64:
        return 1
    return 0
