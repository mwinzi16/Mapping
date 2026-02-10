"""Standardized response envelope for all API responses."""
from __future__ import annotations

from typing import Any, Optional


def success_response(data: Any, meta: Optional[dict] = None) -> dict:
    """Wrap *data* in a standard success envelope.

    Args:
        data: The response payload.
        meta: Optional metadata dict.

    Returns:
        Envelope dict ``{"data": ..., "meta": ...}``.
    """
    response: dict[str, Any] = {"data": data}
    if meta:
        response["meta"] = meta
    return response


def error_response(code: str, message: str, details: Any = None) -> dict:
    """Wrap error information in a standard error envelope.

    Args:
        code: Machine-readable error code.
        message: Human-readable description.
        details: Optional structured details.

    Returns:
        Envelope dict ``{"data": None, "errors": [...]}``.
    """
    error: dict[str, Any] = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"data": None, "errors": [error]}


def paginated_response(
    items: list, total: int, page: int, per_page: int
) -> dict:
    """Wrap paginated data in a standard envelope with pagination meta.

    Args:
        items: The list of items for the current page.
        total: Total number of matching items.
        page: Current page number (1-based).
        per_page: Items per page.

    Returns:
        Envelope dict with ``data`` and ``meta`` keys.
    """
    return {
        "data": items,
        "meta": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
        },
    }
