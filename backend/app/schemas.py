from pydantic import BaseModel, Field


class PrayerTimings(BaseModel):
    fajr: str = Field(..., description="Время Fajr")
    sunrise: str = Field(..., description="Время Sunrise")
    dhuhr: str = Field(..., description="Время Dhuhr")
    asr: str = Field(..., description="Время Asr")
    maghrib: str = Field(..., description="Время Maghrib")
    isha: str = Field(..., description="Время Isha")


class PrayerDateInfo(BaseModel):
    readable: str
    timestamp: str
    gregorian: dict
    hijri: dict


class PrayerMeta(BaseModel):
    latitude: float
    longitude: float
    timezone: str
    method: dict
    latitude_adjustment_method: str | None = None
    midnight_mode: str | None = None
    school: str | None = None
    offset: dict | None = None


class PrayerTimesResponse(BaseModel):
    timings: PrayerTimings
    date: PrayerDateInfo
    meta: PrayerMeta


class ErrorResponse(BaseModel):
    detail: str