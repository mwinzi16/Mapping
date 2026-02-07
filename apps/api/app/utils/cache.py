"""Simple TTL cache for in-memory data."""
from __future__ import annotations

import time
from collections import OrderedDict
from typing import Any, Optional


class TTLCache:
    """Thread-safe TTL cache with max size eviction."""

    def __init__(self, max_size: int = 100, ttl_seconds: int = 3600) -> None:
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        """Return cached value or ``None`` if missing / expired."""
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl:
                self._cache.move_to_end(key)
                return value
            else:
                del self._cache[key]
        return None

    def set(self, key: str, value: Any) -> None:
        """Store *value* under *key*, evicting oldest entry if full."""
        if key in self._cache:
            del self._cache[key]
        elif len(self._cache) >= self._max_size:
            self._cache.popitem(last=False)
        self._cache[key] = (value, time.time())

    def clear(self) -> None:
        """Remove all entries."""
        self._cache.clear()

    def __contains__(self, key: str) -> bool:
        return self.get(key) is not None

    def __len__(self) -> int:
        return len(self._cache)
