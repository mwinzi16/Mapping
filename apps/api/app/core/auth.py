"""API key authentication for the Catastrophe Mapping API."""
from __future__ import annotations

import secrets
from typing import Optional

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader, APIKeyQuery

from app.core.config import settings

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
API_KEY_QUERY = APIKeyQuery(name="api_key", auto_error=False)


async def get_api_key(
    header_key: Optional[str] = Security(API_KEY_HEADER),
    query_key: Optional[str] = Security(API_KEY_QUERY),
) -> str:
    """Validate API key from header or query parameter."""
    api_key = header_key or query_key
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "AUTHENTICATION_ERROR",
                "message": "API key required. Provide via X-API-Key header or api_key query parameter.",
            },
        )
    if not secrets.compare_digest(api_key, settings.API_KEY):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "AUTHENTICATION_ERROR",
                "message": "Invalid API key.",
            },
        )
    return api_key


async def get_optional_api_key(
    header_key: Optional[str] = Security(API_KEY_HEADER),
    query_key: Optional[str] = Security(API_KEY_QUERY),
) -> Optional[str]:
    """Optional API key - returns None if not provided, validates if provided."""
    api_key = header_key or query_key
    if api_key and not secrets.compare_digest(api_key, settings.API_KEY):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "AUTHENTICATION_ERROR",
                "message": "Invalid API key.",
            },
        )
    return api_key
