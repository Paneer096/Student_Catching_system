"""
Makerove — Application Settings

Loads configuration from environment variables and thresholds.yaml.
All secrets come from .env and are never committed, logged, or echoed.
"""
from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache
from typing import Any

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings


# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
APP_DIR = BASE_DIR / "app"
CONFIG_DIR = APP_DIR / "config"
THRESHOLDS_PATH = CONFIG_DIR / "thresholds.yaml"


# ─── Settings from .env ──────────────────────────────────────────────────────
class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── Core ──────────────────────────────────────────────────────────────
    APP_NAME: str = "Makerove"
    APP_TAGLINE: str = "A teacher's sixth sense — support before sanction."
    ENV: str = "development"
    DEBUG: bool = False
    RANDOM_SEED: int = 42
    TIMEZONE: str = "Asia/Kolkata"

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./makerove.db"
    DATABASE_ECHO: bool = False

    # ── Auth & Security ──────────────────────────────────────────────────
    SECRET_KEY: str = Field(default="CHANGE-ME-IN-PRODUCTION-USE-A-REAL-SECRET")
    SESSION_COOKIE_NAME: str = "makerove_session"
    SESSION_IDLE_MINUTES: int = 30
    SESSION_ABSOLUTE_HOURS: int = 12
    CSRF_COOKIE_NAME: str = "makerove_csrf"
    LOGIN_RATE_LIMIT_MAX: int = 5       # per minute per IP+username
    LOGIN_LOCKOUT_MINUTES: int = 15

    # ── CORS ──────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:5174"]

    # ── Gemini LLM ────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.0-flash-lite"
    GEMINI_DAILY_REQUEST_CAP: int = 200
    GEMINI_TIMEOUT_SECONDS: int = 20
    LLM_ENABLED: bool = True

    # ── PII Encryption ────────────────────────────────────────────────────
    FERNET_KEY: str = ""  # Fernet encryption key for PII columns

    # ── Demo Seed Passwords ───────────────────────────────────────────────
    DEMO_TEACHER_PASSWORD: str = "MakeroveTeacher2026!"
    DEMO_ADMIN_PASSWORD: str = "MakeroveAdmin2026!"
    DEMO_STUDENT_PASSWORD: str = "MakeroveStudent2026!"
    DEMO_HOD_PASSWORD: str = "MakeroveHOD2026!"
    DEMO_COUNSELOR_PASSWORD: str = "MakeroveCounselor2026!"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


# ─── Thresholds from YAML ─────────────────────────────────────────────────────
@lru_cache()
def get_thresholds() -> dict[str, Any]:
    """Load and cache thresholds from thresholds.yaml."""
    if not THRESHOLDS_PATH.exists():
        raise FileNotFoundError(
            f"Thresholds config not found at {THRESHOLDS_PATH}. "
            "Ensure thresholds.yaml exists in backend/app/config/"
        )
    with open(THRESHOLDS_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError("thresholds.yaml must be a YAML mapping at the top level.")
    return data


def get_threshold(*keys: str, default: Any = None) -> Any:
    """
    Retrieve a nested threshold value by dotted key path.

    Example:
        get_threshold("group_absence", "min_absentees")  # → 3
        get_threshold("anchor", "weights", "pagerank")    # → 0.5
    """
    data = get_thresholds()
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        else:
            return default
        if data is None:
            return default
    return data
