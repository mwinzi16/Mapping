"""Standardized response envelope for all API responses."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class ApiResponse(BaseModel):
    """Standard API response envelope."""

    data: Any = None
    meta: Optional[dict] = None
    errors: Optional[list] = None


def success_response(data: Any, meta: Optional[dict] = None) -> dict:
    """Wrap data in a standard success envelope."""
    response: dict[str, Any] = {"data": data}
    if meta:
        response["meta"] = meta
    return response


def error_response(code: str, message: str, details: Any = None) -> dict:
    """Wrap error in a standard error envelope."""
    error: dict[str, Any] = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"data": None, "errors": [error]}


def paginated_response(items: list, total: int, page: int, per_page: int) -> dict:
    """Wrap paginated data in a standard envelope with pagination meta."""
    return {
        "data": items,
        "meta": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
        },
    }
