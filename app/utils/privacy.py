"""Privacy utility functions for PII masking."""
from __future__ import annotations


def mask_email(email: str) -> str:
    """Mask an email address for safe logging.

    Args:
        email: The email address to mask.

    Returns:
        A masked version of the email (e.g. ``j***@example.com``).
    """
    if "@" in email:
        local, domain = email.rsplit("@", 1)
        return f"{local[0]}***@{domain}" if local else f"***@{domain}"
    return "***"
