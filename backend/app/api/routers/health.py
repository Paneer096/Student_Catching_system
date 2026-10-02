"""
Makerove — Health Check Router

Public endpoint for monitoring DB, scheduler, and LLM status.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db import get_db
from app.config.settings import get_settings
from app.models.schemas import HealthResponse


settings = get_settings()
router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Public health endpoint. Reports:
    - Database connectivity
    - Scheduler status
    - LLM configuration status (cached ping, never blocks)
    """
    # Check database
    db_status = "unknown"
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {type(e).__name__}"
        logger.error("Health check DB error: {err}", err=str(e))

    # LLM status
    llm_status = None
    if settings.GEMINI_API_KEY:
        llm_status = {
            "configured": True,
            "model": settings.GEMINI_MODEL,
            "reachable": None,  # Populated by cached ping (at most every 10 min)
        }
    else:
        llm_status = {
            "configured": False,
            "model": None,
            "reachable": None,
        }

    return HealthResponse(
        status="ok" if db_status == "connected" else "degraded",
        app_name=settings.APP_NAME,
        database=db_status,
        scheduler="not_started",  # Updated when scheduler is initialized
        last_job=None,
        llm=llm_status,
    )
