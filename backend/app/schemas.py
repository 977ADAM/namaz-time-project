from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class PrayerNameValue(BaseModel):
    key: str
    label: str
    time: str


class PrayerTimings(BaseModel):
    fajr: str = Field(..., description="Fajr")
    sunrise: str = Field(..., description="Sunrise")
    dhuhr: str = Field(..., description="Dhuhr")
    asr: str = Field(..., description="Asr")
    maghrib: str = Field(..., description="Maghrib")
    isha: str = Field(..., description="Isha")


class PrayerDateInfo(BaseModel):
    readable: str = Field(..., description="Readable date from upstream API")
    timestamp: str = Field(..., description="Unix timestamp returned by upstream API")
    gregorian: dict = Field(default_factory=dict)
    hijri: dict = Field(default_factory=dict)


class PrayerMeta(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    latitude: float = Field(..., description="Latitude used for calculation")
    longitude: float = Field(..., description="Longitude used for calculation")
    timezone: str = Field(..., description="Resolved timezone")
    method: dict = Field(default_factory=dict, description="Calculation method details")
    latitude_adjustment_method: str | None = Field(default=None, alias="latitudeAdjustmentMethod")
    midnight_mode: str | None = Field(default=None, alias="midnightMode")
    school: str | None = Field(default=None, description="Asr juristic school")
    offset: dict | None = Field(default=None, description="Prayer-specific offsets")


class PrayerRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    method: int = Field(default=2, description="Aladhan calculation method")
    school: int = Field(default=0, description="0 = Standard, 1 = Hanafi")
    target_date: date = Field(..., alias="date")


class PrayerTimesResponse(BaseModel):
    requested_date: date = Field(..., description="Date requested by client")
    timings: PrayerTimings
    date: PrayerDateInfo
    meta: PrayerMeta
    current_prayer: PrayerNameValue | None = None
    next_prayer: PrayerNameValue | None = None
    next_prayer_date: date | None = None


class ApiLocation(BaseModel):
    id: str | None = None
    city: str
    country: str
    region: str | None = None
    lat: float
    lng: float
    timezone: str


class ApiDateValue(BaseModel):
    gregorian: str
    hijri: str


class ApiMethod(BaseModel):
    id: str
    name: str
    provider_id: int


class ApiPrayerTimesPayload(BaseModel):
    location: ApiLocation
    date: ApiDateValue
    method: ApiMethod
    times: PrayerTimings
    current_prayer: PrayerNameValue | None = None
    next_prayer: PrayerNameValue | None = None
    next_prayer_date: date | None = None


class PrayerCalendarDay(BaseModel):
    requested_date: date
    readable_date: str
    hijri_date: str
    weekday: str
    timings: PrayerTimings


class PrayerCalendarResponse(BaseModel):
    year: int
    month: int
    timezone: str
    method: dict = Field(default_factory=dict)
    days: list[PrayerCalendarDay]


class ApiPrayerCalendarDay(BaseModel):
    date: str
    weekday: str
    hijri: str
    times: PrayerTimings


class ApiPrayerCalendarPayload(BaseModel):
    location: ApiLocation
    year: int
    month: int
    method: ApiMethod
    days: list[ApiPrayerCalendarDay]


class LocationResult(BaseModel):
    id: str
    city: str
    country: str
    region: str | None = None
    display_name: str
    latitude: float
    longitude: float
    timezone: str | None = None


class LocationSearchResponse(BaseModel):
    query: str
    results: list[LocationResult]


class CalculationMethod(BaseModel):
    id: int
    code: str
    name: str


class MethodsResponse(BaseModel):
    methods: list[CalculationMethod]


class ApiErrorBody(BaseModel):
    code: str
    message: str
    details: dict | None = None


class ApiErrorResponse(BaseModel):
    error: ApiErrorBody


class HealthResponse(BaseModel):
    status: str


class ReadinessResponse(BaseModel):
    status: str
    checks: dict[str, str]


class AppMetaResponse(BaseModel):
    app_name: str
    version: str
    environment: str
    docs_url: str
    openapi_url: str


class ErrorResponse(BaseModel):
    detail: str = Field(..., description="Human-readable error message")
