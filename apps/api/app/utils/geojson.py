"""GeoJSON helper functions for building FeatureCollection responses."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence


def alert_to_feature(alert: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Convert an NWS alert dict to a GeoJSON Feature.

    Args:
        alert: Alert dict containing at least latitude, longitude and
            optional event_time / expires_at datetime fields.

    Returns:
        A GeoJSON Feature dict or ``None`` if coordinates are missing.
    """
    lat = alert.get("latitude")
    lon = alert.get("longitude")
    if not lat or not lon:
        return None

    properties = {
        k: v for k, v in alert.items() if k not in {"latitude", "longitude"}
    }
    # Serialise datetime fields to ISO-8601
    for dt_field in ("event_time", "expires_at"):
        val = properties.get(dt_field)
        if val is not None and isinstance(val, datetime):
            properties[dt_field] = val.isoformat()

    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat],
        },
        "properties": properties,
    }


def alerts_to_feature_collection(
    alerts: Sequence[Dict[str, Any]],
    *,
    source: str = "NOAA NWS",
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a GeoJSON FeatureCollection from a list of NWS alerts.

    Args:
        alerts: Iterable of alert dicts.
        source: Data-source label for metadata.
        extra_metadata: Additional key/value pairs merged into
            ``metadata``.

    Returns:
        A GeoJSON FeatureCollection dict.
    """
    features: List[Dict[str, Any]] = []
    for alert in alerts:
        feat = alert_to_feature(alert)
        if feat is not None:
            features.append(feat)

    metadata: Dict[str, Any] = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "count": len(features),
        "source": source,
    }
    if extra_metadata:
        metadata.update(extra_metadata)

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": metadata,
    }


def storm_reports_to_feature_collection(
    reports: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    """Build a GeoJSON FeatureCollection from SPC storm reports.

    Args:
        reports: Mapping of ``report_type`` → list of report dicts,
            each containing ``latitude`` / ``longitude``.

    Returns:
        A GeoJSON FeatureCollection dict with per-type breakdown.
    """
    features: List[Dict[str, Any]] = []
    for report_type, items in reports.items():
        for report in items:
            lat = report.get("latitude")
            lon = report.get("longitude")
            if lat is None or lon is None:
                continue
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lon, lat],
                    },
                    "properties": {
                        "report_type": report_type,
                        **{
                            k: v
                            for k, v in report.items()
                            if k not in {"latitude", "longitude"}
                        },
                    },
                }
            )

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "generated": datetime.now(timezone.utc).isoformat(),
            "count": len(features),
            "source": "NOAA SPC",
            "breakdown": {
                rtype: len(items) for rtype, items in reports.items()
            },
        },
    }
