from datetime import date

from fastapi import FastAPI, HTTPException, Query

from app.schemas import PrayerTimesResponse, ErrorResponse
from app.service import PrayerTimesService

app = FastAPI(
    title="Prayer Times API",
    version="1.0.0",
    description="API для расчета времени намаза в реальном времени",
)

service = PrayerTimesService()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get(
    "/v1/prayer-times",
    response_model=PrayerTimesResponse,
    responses={400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def get_prayer_times(
    latitude: float = Query(..., ge=-90, le=90, description="Широта"),
    longitude: float = Query(..., ge=-180, le=180, description="Долгота"),
    method: int = Query(2, description="Метод расчета"),
    school: int = Query(0, description="0 = Standard, 1 = Hanafi"),
    date_value: date = Query(default_factory=date.today, alias="date"),
):
    """
    Получить время намаза по координатам и дате.
    """
    try:
        result = await service.get_prayer_times(
            latitude=latitude,
            longitude=longitude,
            method=method,
            school=school,
            target_date=date_value,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))