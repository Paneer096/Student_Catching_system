"""
Makerove — FastAPI Application

Classroom intelligence platform that builds a social knowledge graph from
attendance, marks, timetable, surveys, and academic calendar data to detect
mass bunks, identify influencers and at-risk students, predict high-risk days,
and suggest proactive, ethical interventions.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.config.settings import get_settings
from app.db import init_db
from app.logging_config import setup_logging
from app.api.routers import (
    auth,
    health,
    admin,
    dashboard,
    graph,
    ingest,
    detection,
    calendar,
    interventions,
    students,
    audit,
)


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # ── Startup ──────────────────────────────────────────────────────────
    setup_logging(debug=settings.DEBUG)
    logger.info("Starting {app} — {tagline}", app=settings.APP_NAME, tagline=settings.APP_TAGLINE)

    # Initialize database tables
    await init_db()
    logger.info("Database initialized")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────
    logger.info("Shutting down {app}", app=settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Classroom intelligence platform — builds a social knowledge graph to detect "
        "group absences, identify influencers and at-risk students, predict high-risk days, "
        "and suggest proactive, ethical interventions. "
        "A teacher's sixth sense — support before sanction."
    ),
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)


# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


# ── Request ID Middleware ────────────────────────────────────────────────────
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add a unique request ID to every response for tracing."""
    import uuid
    request_id = str(uuid.uuid4())[:8]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ── Global Exception Handler ────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch unhandled exceptions. Never expose stack traces to clients (§3.3).
    """
    logger.error("Unhandled error: {err}", err=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again later."},
    )


# ── Mount Routers ────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(detection.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(interventions.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")


# ── Root ─────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "tagline": settings.APP_TAGLINE,
        "api": "/api/v1",
        "health": "/api/v1/health",
    }
