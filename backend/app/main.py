from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.schemas import ErrorResponse, PrayerTimesResponse
from app.service import PrayerTimesService, build_prayer_request

app = FastAPI(
    title="Prayer Times API",
    version="1.0.0",
    description="Minimal MVP for fetching prayer times by coordinates and date.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = PrayerTimesService()
ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT_DIR / "frontend"
STATIC_DIR = FRONTEND_DIR / "static"

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", response_model=None)
async def home() -> HTMLResponse | dict[str, str]:
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return HTMLResponse(index_file.read_text(encoding="utf-8"))
    return {"message": "Prayer Times API is running"}


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
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
