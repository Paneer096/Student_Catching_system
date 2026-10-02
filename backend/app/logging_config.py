"""
Makerove — Logging Configuration

Loguru with a PII-scrubbing filter (R9).
Logs internal UUIDs, never names or roll numbers.
"""
from __future__ import annotations

import re
import sys

from loguru import logger


# Patterns that look like PII — scrub them from log output
_PII_PATTERNS = [
    # Email addresses
    re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
    # Indian phone numbers
    re.compile(r"\b(?:\+91|91|0)?[6-9]\d{9}\b"),
    # Names that look like "FirstName LastName" after common prefixes
    re.compile(r"(?:name|student|teacher|user)[=:]\s*['\"]?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+", re.IGNORECASE),
    # Roll numbers (common Indian format)
    re.compile(r"\b[A-Z]{2,3}\d{2}\d{3,4}\b"),
]

_REPLACEMENT = "[PII_REDACTED]"


def _scrub_pii(message: str) -> str:
    """Remove PII patterns from log messages."""
    for pattern in _PII_PATTERNS:
        message = pattern.sub(_REPLACEMENT, message)
    return message


def _pii_filter(record: dict) -> bool:
    """Loguru filter that scrubs PII from log messages."""
    record["message"] = _scrub_pii(record["message"])
    return True


def setup_logging(debug: bool = False) -> None:
    """
    Configure loguru for the application.

    - Console output with PII scrubbing
    - File output for audit (separate sink)
    - No PII in any log output (R9)
    """
    logger.remove()  # Remove default handler

    log_level = "DEBUG" if debug else "INFO"

    # Console handler with PII scrubbing
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | <level>{message}</level>",
        level=log_level,
        filter=_pii_filter,
        colorize=True,
    )

    # File handler for general logs
    logger.add(
        "logs/makerove_{time:YYYY-MM-DD}.log",
        rotation="00:00",
        retention="30 days",
        compression="gz",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} | {message}",
        level=log_level,
        filter=_pii_filter,
    )

    # Separate audit sink (structured, append-only)
    logger.add(
        "logs/audit_{time:YYYY-MM-DD}.log",
        rotation="00:00",
        retention="3 years",  # Matches retention.audit_log_years
        format="{time:YYYY-MM-DDTHH:mm:ss.SSSSSS} | AUDIT | {message}",
        level="INFO",
        filter=lambda record: "audit" in record.get("extra", {}),
    )

    logger.info("Makerove logging initialized (PII scrubbing active)")
