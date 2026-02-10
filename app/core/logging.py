"""Structured logging configuration using structlog."""
from __future__ import annotations

import logging

import structlog


def setup_logging(debug: bool = False) -> None:
    """Configure structlog for JSON structured logging.

    Args:
        debug: When ``True`` use console renderer and DEBUG level;
            otherwise use JSON renderer and INFO level.
    """
    log_level = logging.DEBUG if debug else logging.INFO

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
            if debug
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    """Get a structured logger instance.

    Args:
        name: Logger name (typically ``__name__``).

    Returns:
        A bound structlog logger.
    """
    return structlog.get_logger(name)
