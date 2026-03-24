import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.rate_limit import InMemoryRateLimiter
from app.schemas import (
    ApiErrorBody,
    ApiErrorResponse,
    ApiPrayerCalendarPayload,
    ApiPrayerTimesPayload,
    AppMetaResponse,
    CalculationMethod,
    ErrorResponse,
    HealthResponse,
    LocationSearchResponse,
    MetricsResponse,
    MethodsResponse,
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
rate_limiter = InMemoryRateLimiter(
    requests=settings.rate_limit_requests,
    window_seconds=settings.rate_limit_window_seconds,
)
ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT_DIR / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
ASSETS_DIR = DIST_DIR / "assets"
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


def api_error(code: str, message: str, details: dict | None = None) -> dict:
    return ApiErrorResponse(error=ApiErrorBody(code=code, message=message, details=details)).model_dump()


def map_runtime_error(exc: RuntimeError) -> tuple[int, str]:
    message = str(exc).lower()
    if "timed out" in message or "timeout" in message:
        return 504, "UPSTREAM_TIMEOUT"
    if "429" in message or "rate" in message:
        return 429, "RATE_LIMITED"
    if "unavailable" in message:
        return 502, "UPSTREAM_TIMEOUT"
    return 502, "UPSTREAM_BAD_RESPONSE"


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def is_rate_limited_path(path: str) -> bool:
    exempt_prefixes = ("/health", "/ready", "/docs", "/openapi.json", "/assets", "/favicon.ico")
    return not path.startswith(exempt_prefixes)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")
elif STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    started_at = time.perf_counter()
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    request.state.request_id = request_id

    if settings.rate_limit_enabled and is_rate_limited_path(request.url.path):
        client_ip = get_client_ip(request)
        result = rate_limiter.check(f"{client_ip}:{request.url.path}")
        request.state.rate_limit_result = result
        if not result.allowed:
            logger.warning("Rate limit exceeded", extra={"client_ip": client_ip, "path": request.url.path})
            response = JSONResponse(
                status_code=429,
                content=api_error(
                    "RATE_LIMITED",
                    "Too many requests. Please try again later.",
                    {"retry_after_seconds": result.reset_after_seconds},
                ),
            )
            response.headers["Retry-After"] = str(result.reset_after_seconds)
            response.headers["X-RateLimit-Remaining"] = "0"
            response.headers["X-Request-Id"] = request_id
            return response

    response = await call_next(request)
    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(duration_ms)
    response.headers["X-Request-Id"] = request_id
    rate_limit_result = getattr(request.state, "rate_limit_result", None)
    if rate_limit_result is not None:
        response.headers["X-RateLimit-Remaining"] = str(rate_limit_result.remaining)
        response.headers["X-RateLimit-Reset"] = str(rate_limit_result.reset_after_seconds)
    if settings.security_headers_enabled:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    logger.info(
        "%s %s -> %s in %sms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        extra={"request_id": request_id},
    )
    return response


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_: Request, exc: RuntimeError) -> JSONResponse:
    status_code, code = map_runtime_error(exc)
    return JSONResponse(status_code=status_code, content=api_error(code, str(exc)))


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    detail = str(exc.detail)
    if exc.status_code == 404:
        code = "CITY_NOT_FOUND" if "city not found" in detail.lower() else "NOT_FOUND"
    elif exc.status_code == 400:
        code = "INVALID_INPUT"
    else:
        code = "INTERNAL_ERROR"
    return JSONResponse(status_code=exc.status_code, content=api_error(code, detail))


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception for request", extra={"path": request.url.path})
    return JSONResponse(
        status_code=500,
        content=api_error(
            "INTERNAL_ERROR",
            "An unexpected internal error occurred.",
            {"request_id": getattr(request.state, "request_id", None)},
        ),
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/ready", response_model=ReadinessResponse)
async def ready() -> ReadinessResponse:
    upstream_status = "ok" if await service.check_ready() else "degraded"
    status = "ok" if upstream_status == "ok" else "degraded"
    checks = {
        "app": "ok",
        "upstream_client": upstream_status,
        "rate_limiter": "ok" if settings.rate_limit_enabled else "disabled",
    }
    return ReadinessResponse(status=status, checks=checks)


@app.get("/v1/meta", response_model=AppMetaResponse)
async def app_meta() -> AppMetaResponse:
    return AppMetaResponse(
        app_name=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )


@app.get("/metrics", response_model=MetricsResponse)
async def metrics() -> MetricsResponse:
    if not settings.metrics_enabled:
        raise HTTPException(status_code=404, detail="Metrics endpoint is disabled")
    return MetricsResponse(
        environment=settings.environment,
        version=settings.app_version,
        cache=service.get_stats(),
        rate_limit=(
            {"enabled": "true", **rate_limiter.get_stats()}
            if settings.rate_limit_enabled
            else {"enabled": "false"}
        ),
    )


def render_index() -> HTMLResponse | dict[str, str]:
    index_file = DIST_DIR / "index.html" if (DIST_DIR / "index.html").exists() else FRONTEND_DIR / "index.html"
    if index_file.exists():
        return HTMLResponse(index_file.read_text(encoding="utf-8"))
    return {"message": f"{settings.app_name} is running"}


@app.get("/", response_model=None)
async def home() -> HTMLResponse | dict[str, str]:
    return render_index()


@app.get("/monthly", response_model=None)
async def monthly_page() -> HTMLResponse | dict[str, str]:
    return render_index()


@app.get("/settings", response_model=None)
async def settings_page() -> HTMLResponse | dict[str, str]:
    return render_index()


@app.get("/about", response_model=None)
async def about_page() -> HTMLResponse | dict[str, str]:
    return render_index()


@app.get(
    "/v1/prayer-times",
    response_model=PrayerTimesResponse,
    responses={400: {"model": ApiErrorResponse}, 502: {"model": ApiErrorResponse}},
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
    "/api/v1/prayer-times/today",
    response_model=ApiPrayerTimesPayload,
    responses={400: {"model": ApiErrorResponse}, 404: {"model": ApiErrorResponse}, 502: {"model": ApiErrorResponse}},
)
async def get_prayer_times_today(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    city: str | None = Query(default=None, min_length=2),
    country: str | None = Query(default=None),
    timezone: str | None = Query(default=None),
    method: int = Query(2),
    date_value: date = Query(default_factory=date.today, alias="date"),
    school: int = Query(0),
) -> ApiPrayerTimesPayload:
    try:
        location = await service.resolve_location(
            latitude=lat,
            longitude=lng,
            city=city,
            country=country,
            timezone=timezone,
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail.startswith("City not found") else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc

    legacy_response = await get_prayer_times(
        latitude=location.latitude,
        longitude=location.longitude,
        method=method,
        school=school,
        date_value=date_value,
    )
    return service.to_api_prayer_times_payload(legacy_response, location, method_id=method)


@app.get(
    "/v1/prayer-calendar",
    response_model=PrayerCalendarResponse,
    responses={400: {"model": ApiErrorResponse}, 502: {"model": ApiErrorResponse}},
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
    "/api/v1/prayer-times/monthly",
    response_model=ApiPrayerCalendarPayload,
    responses={400: {"model": ApiErrorResponse}, 404: {"model": ApiErrorResponse}, 502: {"model": ApiErrorResponse}},
)
async def get_prayer_times_monthly(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    city: str | None = Query(default=None, min_length=2),
    country: str | None = Query(default=None),
    timezone: str | None = Query(default=None),
    method: int = Query(2),
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    school: int = Query(0),
) -> ApiPrayerCalendarPayload:
    try:
        location = await service.resolve_location(
            latitude=lat,
            longitude=lng,
            city=city,
            country=country,
            timezone=timezone,
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail.startswith("City not found") else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc

    legacy_response = await get_prayer_calendar(
        latitude=location.latitude,
        longitude=location.longitude,
        method=method,
        school=school,
        year=year,
        month=month,
    )
    return service.to_api_prayer_calendar_payload(legacy_response, location, method_id=method)


@app.get(
    "/v1/locations/search",
    response_model=LocationSearchResponse,
    responses={502: {"model": ApiErrorResponse}},
)
async def search_locations(
    q: str = Query(..., min_length=2, description="City or place query"),
    limit: int = Query(5, ge=1, le=10),
) -> LocationSearchResponse:
    results = await service.search_locations(q, limit=limit)
    return LocationSearchResponse(query=q, results=results)


@app.get(
    "/api/v1/cities/search",
    response_model=LocationSearchResponse,
    responses={400: {"model": ApiErrorResponse}, 502: {"model": ApiErrorResponse}},
)
async def search_cities(
    q: str = Query(..., min_length=2, description="City or place query"),
    limit: int = Query(5, ge=1, le=10),
) -> LocationSearchResponse:
    return await search_locations(q=q, limit=limit)


@app.get(
    "/v1/locations/reverse",
    response_model=LocationSearchResponse,
    responses={400: {"model": ApiErrorResponse}, 502: {"model": ApiErrorResponse}},
)
async def reverse_location(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
) -> LocationSearchResponse:
    result = await service.reverse_geocode(latitude=latitude, longitude=longitude)
    return LocationSearchResponse(query=f"{latitude},{longitude}", results=[result])


@app.get(
    "/api/v1/location/reverse",
    response_model=LocationSearchResponse,
    responses={400: {"model": ApiErrorResponse}, 502: {"model": ApiErrorResponse}},
)
async def reverse_location_api(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> LocationSearchResponse:
    return await reverse_location(latitude=lat, longitude=lng)


@app.get("/api/v1/config/methods", response_model=MethodsResponse)
async def config_methods() -> MethodsResponse:
    methods = [CalculationMethod(**item) for item in service.get_methods()]
    return MethodsResponse(methods=methods)
