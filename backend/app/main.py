import logging
import time
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.schemas import (
    AppMetaResponse,
    ErrorResponse,
    HealthResponse,
    LocationSearchResponse,
    PrayerCalendarResponse,
    PrayerTimesResponse,
    ReadinessResponse,
)
from app.service import PrayerTimesService, build_prayer_request

logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

service = PrayerTimesService()
ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT_DIR / "frontend"
STATIC_DIR = FRONTEND_DIR / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting %s in %s", settings.app_name, settings.environment)
    try:
        yield
    finally:
        await service.close()
        logger.info("Stopped %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Production-lite prayer times service built with FastAPI.",
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(duration_ms)
    logger.info("%s %s -> %s in %sms", request.method, request.url.path, response.status_code, duration_ms)
    return response


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_: Request, exc: RuntimeError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/ready", response_model=ReadinessResponse)
async def ready() -> ReadinessResponse:
    upstream_status = "ok" if await service.check_ready() else "degraded"
    status = "ok" if upstream_status == "ok" else "degraded"
    return ReadinessResponse(status=status, checks={"app": "ok", "upstream_client": upstream_status})


@app.get("/v1/meta", response_model=AppMetaResponse)
async def app_meta() -> AppMetaResponse:
    return AppMetaResponse(
        app_name=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )


@app.get("/", response_model=None)
async def home() -> HTMLResponse | dict[str, str]:
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return HTMLResponse(index_file.read_text(encoding="utf-8"))
    return {"message": f"{settings.app_name} is running"}


@app.get(
    "/v1/prayer-times",
    response_model=PrayerTimesResponse,
    responses={400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def get_prayer_times(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    method: int = Query(2, description="Calculation method"),
    school: int = Query(0, description="0 = Standard, 1 = Hanafi"),
    date_value: date = Query(default_factory=date.today, alias="date"),
) -> PrayerTimesResponse:
    try:
        request = build_prayer_request(
            latitude=latitude,
            longitude=longitude,
            method=method,
            school=school,
            target_date=date_value,
        )
        return await service.get_prayer_times(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get(
    "/v1/prayer-calendar",
    response_model=PrayerCalendarResponse,
    responses={400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def get_prayer_calendar(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    method: int = Query(2, description="Calculation method"),
    school: int = Query(0, description="0 = Standard, 1 = Hanafi"),
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> PrayerCalendarResponse:
    try:
        return await service.get_prayer_calendar(
            latitude=latitude,
            longitude=longitude,
            method=method,
            school=school,
            year=year,
            month=month,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get(
    "/v1/locations/search",
    response_model=LocationSearchResponse,
    responses={502: {"model": ErrorResponse}},
)
async def search_locations(
    q: str = Query(..., min_length=2, description="City or place query"),
    limit: int = Query(5, ge=1, le=10),
) -> LocationSearchResponse:
    results = await service.search_locations(q, limit=limit)
    return LocationSearchResponse(query=q, results=results)


@app.get(
    "/v1/locations/reverse",
    response_model=LocationSearchResponse,
    responses={400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def reverse_location(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
) -> LocationSearchResponse:
    result = await service.reverse_geocode(latitude=latitude, longitude=longitude)
    return LocationSearchResponse(query=f"{latitude},{longitude}", results=[result])
