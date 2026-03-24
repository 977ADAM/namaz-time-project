import logging
from datetime import date, datetime
from time import monotonic
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from app.config import settings
from app.schemas import (
    ApiDateValue,
    ApiLocation,
    ApiMethod,
    ApiPrayerCalendarDay,
    ApiPrayerCalendarPayload,
    ApiPrayerTimesPayload,
    LocationResult,
    PrayerCalendarDay,
    PrayerCalendarResponse,
    PrayerDateInfo,
    PrayerMeta,
    PrayerNameValue,
    PrayerRequest,
    PrayerTimesResponse,
    PrayerTimings,
)

logger = logging.getLogger(__name__)


class PrayerTimesService:
    ALLOWED_METHODS = {0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
    CALCULATION_METHODS = [
        {"id": 3, "code": "MWL", "name": "Muslim World League"},
        {"id": 4, "code": "UMM_AL_QURA", "name": "Umm al-Qura University, Makkah"},
        {"id": 5, "code": "EGYPT", "name": "Egyptian General Authority of Survey"},
        {"id": 1, "code": "KARACHI", "name": "University of Islamic Sciences, Karachi"},
        {"id": 2, "code": "ISNA", "name": "Islamic Society of North America"},
        {"id": 7, "code": "TEHRAN", "name": "Institute of Geophysics, University of Tehran"},
        {"id": 0, "code": "JAFARI", "name": "Jafari / Shia Ithna-Ashari"},
    ]

    def __init__(
        self,
        *,
        base_url: str | None = None,
        timeout_seconds: int | None = None,
        cache_ttl_seconds: int | None = None,
    ) -> None:
        self.base_url = base_url or settings.prayer_api_base_url
        self.timeout_seconds = timeout_seconds or settings.prayer_api_timeout_seconds
        self.cache_ttl_seconds = cache_ttl_seconds if cache_ttl_seconds is not None else settings.cache_ttl_seconds
        self.calendar_base_url = self.base_url.replace("/timings", "/calendar")
        self.geo_search_url = "https://nominatim.openstreetmap.org/search"
        self.geo_reverse_url = "https://nominatim.openstreetmap.org/reverse"
        self._client: httpx.AsyncClient | None = None
        self._cache: dict[tuple[float, float, int, int, str], tuple[float, PrayerTimesResponse]] = {}
        self._calendar_cache: dict[tuple[float, float, int, int, int, int], tuple[float, PrayerCalendarResponse]] = {}
        self._timezone_cache: dict[tuple[float, float], tuple[float, str]] = {}
        self._location_cache: dict[tuple[float, float], tuple[float, LocationResult]] = {}
        self._stats: dict[str, int] = {
            "daily_cache_hits": 0,
            "daily_cache_misses": 0,
            "calendar_cache_hits": 0,
            "calendar_cache_misses": 0,
            "timezone_cache_hits": 0,
            "timezone_cache_misses": 0,
            "location_cache_hits": 0,
            "location_cache_misses": 0,
        }

    async def get_prayer_times(self, request: PrayerRequest) -> PrayerTimesResponse:
        self._validate_method(request.method)
        self._validate_school(request.school)

        cache_key = self._build_cache_key(request)
        cached = self._get_cached(cache_key)
        if cached is not None:
            self._stats["daily_cache_hits"] += 1
            logger.debug("Serving prayer times from cache", extra={"cache_key": cache_key})
            return cached
        self._stats["daily_cache_misses"] += 1

        payload = await self._fetch_timings(request)
        result = self._map_payload(request, payload)
        self._cache_response(cache_key, result)
        return result

    async def get_prayer_calendar(
        self,
        *,
        latitude: float,
        longitude: float,
        method: int,
        school: int,
        year: int,
        month: int,
    ) -> PrayerCalendarResponse:
        self._validate_method(method)
        self._validate_school(school)

        cache_key = (round(latitude, 4), round(longitude, 4), method, school, year, month)
        cached = self._get_calendar_cached(cache_key)
        if cached is not None:
            self._stats["calendar_cache_hits"] += 1
            return cached
        self._stats["calendar_cache_misses"] += 1

        payload = await self._fetch_calendar(
            latitude=latitude,
            longitude=longitude,
            method=method,
            school=school,
            year=year,
            month=month,
        )
        result = self._map_calendar_payload(payload, year=year, month=month)
        self._cache_calendar_response(cache_key, result)
        return result

    async def search_locations(self, query: str, *, limit: int = 5) -> list[LocationResult]:
        if not query.strip():
            return []

        client = await self._get_client()
        try:
            response = await client.get(
                self.geo_search_url,
                params={"q": query, "format": "jsonv2", "addressdetails": 1, "limit": limit},
                headers={"User-Agent": settings.app_name},
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"Location search failed with HTTP {exc.response.status_code}") from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"Location search is unavailable: {exc}") from exc

        results = [self._map_location_result(item) for item in response.json()]
        for result in results:
            result.timezone = await self._resolve_timezone(result.latitude, result.longitude)
        return results

    async def reverse_geocode(self, *, latitude: float, longitude: float) -> LocationResult:
        cache_key = (round(latitude, 3), round(longitude, 3))
        cached = self._location_cache.get(cache_key)
        if cached is not None:
            expires_at, result = cached
            if expires_at > monotonic():
                self._stats["location_cache_hits"] += 1
                return result.model_copy(deep=True)
            self._location_cache.pop(cache_key, None)
        self._stats["location_cache_misses"] += 1

        client = await self._get_client()
        try:
            response = await client.get(
                self.geo_reverse_url,
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "zoom": 10,
                },
                headers={"User-Agent": settings.app_name},
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"Reverse geocoding failed with HTTP {exc.response.status_code}") from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"Reverse geocoding is unavailable: {exc}") from exc

        result = self._map_location_result(response.json())
        result.timezone = await self._resolve_timezone(result.latitude, result.longitude)
        if self.cache_ttl_seconds > 0:
            self._location_cache[cache_key] = (monotonic() + self.cache_ttl_seconds, result.model_copy(deep=True))
        return result

    async def resolve_location(
        self,
        *,
        latitude: float | None,
        longitude: float | None,
        city: str | None = None,
        country: str | None = None,
        timezone: str | None = None,
    ) -> LocationResult:
        if latitude is not None and longitude is not None:
            result = await self.reverse_geocode(latitude=latitude, longitude=longitude)
            if timezone:
                result.timezone = timezone
            return result

        if not city:
            raise ValueError("Either lat/lng or city must be provided")

        query = ", ".join(part for part in [city.strip(), (country or "").strip()] if part)
        results = await self.search_locations(query, limit=1)
        if not results:
            raise ValueError(f"City not found: {city}")
        result = results[0]
        if timezone:
            result.timezone = timezone
        return result

    def get_methods(self) -> list[dict[str, str | int]]:
        return self.CALCULATION_METHODS

    def get_method(self, provider_id: int) -> dict[str, str | int]:
        for method in self.CALCULATION_METHODS:
            if method["id"] == provider_id:
                return method
        raise ValueError(f"Invalid method={provider_id}. Allowed values: {sorted(self.ALLOWED_METHODS)}")

    async def check_ready(self) -> bool:
        try:
            await self._get_client()
        except RuntimeError:
            return False
        return True

    def get_stats(self) -> dict[str, int]:
        return self._stats.copy()

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=self.timeout_seconds,
                headers={"Accept-Language": "en"},
            )
        return self._client

    def _map_payload(self, request: PrayerRequest, payload: dict) -> PrayerTimesResponse:
        data = payload["data"]
        timings_raw = data.get("timings") or {}
        date_raw = data.get("date") or {}
        meta_raw = data.get("meta") or {}

        response = PrayerTimesResponse(
            requested_date=request.target_date,
            timings=PrayerTimings(
                fajr=self._clean_time(timings_raw.get("Fajr")),
                sunrise=self._clean_time(timings_raw.get("Sunrise")),
                dhuhr=self._clean_time(timings_raw.get("Dhuhr")),
                asr=self._clean_time(timings_raw.get("Asr")),
                maghrib=self._clean_time(timings_raw.get("Maghrib")),
                isha=self._clean_time(timings_raw.get("Isha")),
            ),
            date=PrayerDateInfo(
                readable=date_raw.get("readable", ""),
                timestamp=str(date_raw.get("timestamp", "")),
                gregorian=date_raw.get("gregorian") or {},
                hijri=date_raw.get("hijri") or {},
            ),
            meta=PrayerMeta(
                latitude=float(meta_raw.get("latitude", request.latitude)),
                longitude=float(meta_raw.get("longitude", request.longitude)),
                timezone=meta_raw.get("timezone", ""),
                method=meta_raw.get("method") or {},
                latitudeAdjustmentMethod=meta_raw.get("latitudeAdjustmentMethod"),
                midnightMode=meta_raw.get("midnightMode"),
                school=meta_raw.get("school"),
                offset=meta_raw.get("offset"),
            ),
        )
        response.current_prayer = self._detect_current_prayer(response)
        response.next_prayer = self._detect_next_prayer(response)
        response.next_prayer_date = request.target_date if response.next_prayer else None
        return response

    def _map_calendar_payload(self, payload: dict, *, year: int, month: int) -> PrayerCalendarResponse:
        entries = payload.get("data") or []
        days: list[PrayerCalendarDay] = []
        timezone = ""
        method: dict = {}

        for entry in entries:
            timings_raw = entry.get("timings") or {}
            date_raw = entry.get("date") or {}
            meta_raw = entry.get("meta") or {}
            timezone = timezone or meta_raw.get("timezone", "")
            method = method or (meta_raw.get("method") or {})
            gregorian_date = (date_raw.get("gregorian") or {}).get("date")
            if not gregorian_date:
                continue
            parsed_date = datetime.strptime(gregorian_date, "%d-%m-%Y").date()
            days.append(
                PrayerCalendarDay(
                    requested_date=parsed_date,
                    readable_date=date_raw.get("readable", parsed_date.isoformat()),
                    hijri_date=(date_raw.get("hijri") or {}).get("date", ""),
                    weekday=parsed_date.strftime("%A"),
                    timings=PrayerTimings(
                        fajr=self._clean_time(timings_raw.get("Fajr")),
                        sunrise=self._clean_time(timings_raw.get("Sunrise")),
                        dhuhr=self._clean_time(timings_raw.get("Dhuhr")),
                        asr=self._clean_time(timings_raw.get("Asr")),
                        maghrib=self._clean_time(timings_raw.get("Maghrib")),
                        isha=self._clean_time(timings_raw.get("Isha")),
                    ),
                )
            )

        return PrayerCalendarResponse(year=year, month=month, timezone=timezone, method=method, days=days)

    async def _fetch_timings(self, request: PrayerRequest) -> dict:
        date_str = request.target_date.strftime("%d-%m-%Y")
        url = f"{self.base_url}/{date_str}"
        params = {
            "latitude": request.latitude,
            "longitude": request.longitude,
            "method": request.method,
            "school": request.school,
        }

        try:
            client = await self._get_client()
            response = await client.get(url, params=params)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Prayer API returned HTTP {exc.response.status_code} for {request.target_date.isoformat()}"
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"Prayer API is unavailable: {exc}") from exc

        payload = response.json()
        if payload.get("code") != 200 or "data" not in payload:
            raise RuntimeError("Prayer API returned an unexpected payload")

        return payload

    async def _fetch_calendar(
        self,
        *,
        latitude: float,
        longitude: float,
        method: int,
        school: int,
        year: int,
        month: int,
    ) -> dict:
        url = f"{self.calendar_base_url}/{year}/{month}"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "method": method,
            "school": school,
        }
        try:
            client = await self._get_client()
            response = await client.get(url, params=params)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"Prayer calendar API returned HTTP {exc.response.status_code}") from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"Prayer calendar API is unavailable: {exc}") from exc

        payload = response.json()
        if payload.get("code") != 200 or "data" not in payload:
            raise RuntimeError("Prayer calendar API returned an unexpected payload")
        return payload

    def _build_cache_key(self, request: PrayerRequest) -> tuple[float, float, int, int, str]:
        return (
            round(request.latitude, 4),
            round(request.longitude, 4),
            request.method,
            request.school,
            request.target_date.isoformat(),
        )

    def _get_cached(self, cache_key: tuple[float, float, int, int, str]) -> PrayerTimesResponse | None:
        cached = self._cache.get(cache_key)
        if cached is None:
            return None

        expires_at, response = cached
        if expires_at <= monotonic():
            self._cache.pop(cache_key, None)
            return None

        return response.model_copy(deep=True)

    def _get_calendar_cached(
        self, cache_key: tuple[float, float, int, int, int, int]
    ) -> PrayerCalendarResponse | None:
        cached = self._calendar_cache.get(cache_key)
        if cached is None:
            return None
        expires_at, response = cached
        if expires_at <= monotonic():
            self._calendar_cache.pop(cache_key, None)
            return None
        return response.model_copy(deep=True)

    def _cache_response(
        self,
        cache_key: tuple[float, float, int, int, str],
        response: PrayerTimesResponse,
    ) -> None:
        if self.cache_ttl_seconds <= 0:
            return

        self._cache[cache_key] = (
            monotonic() + self.cache_ttl_seconds,
            response.model_copy(deep=True),
        )

    def _cache_calendar_response(
        self,
        cache_key: tuple[float, float, int, int, int, int],
        response: PrayerCalendarResponse,
    ) -> None:
        if self.cache_ttl_seconds <= 0:
            return
        self._calendar_cache[cache_key] = (
            monotonic() + self.cache_ttl_seconds,
            response.model_copy(deep=True),
        )

    def _detect_current_prayer(self, response: PrayerTimesResponse) -> PrayerNameValue | None:
        timezone = response.meta.timezone
        if not timezone:
            return None

        try:
            zone = ZoneInfo(timezone)
        except ZoneInfoNotFoundError:
            return None

        now = datetime.now(zone)
        prayer_sequence = [
            ("isha", "Иша", response.timings.isha),
            ("maghrib", "Магриб", response.timings.maghrib),
            ("asr", "Аср", response.timings.asr),
            ("dhuhr", "Зухр", response.timings.dhuhr),
            ("fajr", "Фаджр", response.timings.fajr),
        ]

        for key, label, value in prayer_sequence:
            if not value:
                continue
            prayer_time = self._build_prayer_datetime(response.requested_date, value, zone)
            if prayer_time <= now:
                return PrayerNameValue(key=key, label=label, time=value)
        return None

    def _detect_next_prayer(self, response: PrayerTimesResponse) -> PrayerNameValue | None:
        timezone = response.meta.timezone
        if not timezone:
            return None

        try:
            zone = ZoneInfo(timezone)
        except ZoneInfoNotFoundError:
            return None

        now = datetime.now(zone)
        prayer_sequence = [
            ("fajr", "Фаджр", response.timings.fajr),
            ("dhuhr", "Зухр", response.timings.dhuhr),
            ("asr", "Аср", response.timings.asr),
            ("maghrib", "Магриб", response.timings.maghrib),
            ("isha", "Иша", response.timings.isha),
        ]

        for key, label, value in prayer_sequence:
            if not value:
                continue
            prayer_time = self._build_prayer_datetime(response.requested_date, value, zone)
            if prayer_time >= now:
                return PrayerNameValue(key=key, label=label, time=value)
        return None

    @staticmethod
    def _build_prayer_datetime(target_date: date, value: str, zone: ZoneInfo) -> datetime:
        hour, minute = map(int, value.split(":"))
        return datetime.combine(target_date, datetime.min.time(), tzinfo=zone).replace(hour=hour, minute=minute)

    async def _resolve_timezone(self, latitude: float, longitude: float) -> str | None:
        cache_key = (round(latitude, 3), round(longitude, 3))
        cached = self._timezone_cache.get(cache_key)
        if cached is not None:
            expires_at, timezone = cached
            if expires_at > monotonic():
                self._stats["timezone_cache_hits"] += 1
                return timezone
            self._timezone_cache.pop(cache_key, None)
        self._stats["timezone_cache_misses"] += 1

        request = build_prayer_request(
            latitude=latitude,
            longitude=longitude,
            method=2,
            school=0,
            target_date=date.today(),
        )
        try:
            payload = await self._fetch_timings(request)
            timezone = ((payload.get("data") or {}).get("meta") or {}).get("timezone")
        except RuntimeError:
            timezone = None

        if timezone:
            self._timezone_cache[cache_key] = (monotonic() + self.cache_ttl_seconds, timezone)
        return timezone

    @staticmethod
    def _map_location_result(item: dict) -> LocationResult:
        address = item.get("address") or {}
        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("municipality")
            or address.get("state")
            or "Unknown place"
        )
        country = address.get("country", "")
        return LocationResult(
            id=str(item.get("place_id", f"{city}-{country}")),
            city=city,
            country=country,
            region=address.get("state") or address.get("county"),
            display_name=item.get("display_name", f"{city}, {country}").strip(", "),
            latitude=float(item.get("lat", 0.0)),
            longitude=float(item.get("lon", 0.0)),
            timezone=None,
        )

    @staticmethod
    def _clean_time(value: str | None) -> str:
        if not value:
            return ""
        return value.split(" ")[0].strip()

    def to_api_prayer_times_payload(
        self,
        response: PrayerTimesResponse,
        location: LocationResult,
        *,
        method_id: int,
    ) -> ApiPrayerTimesPayload:
        method = self.get_method(method_id)
        return ApiPrayerTimesPayload(
            location=ApiLocation(
                id=location.id,
                city=location.city,
                country=location.country,
                region=location.region,
                lat=location.latitude,
                lng=location.longitude,
                timezone=location.timezone or response.meta.timezone,
            ),
            date=ApiDateValue(
                gregorian=response.requested_date.isoformat(),
                hijri=(response.date.hijri or {}).get("date", ""),
            ),
            method=ApiMethod(
                id=str(method["code"]),
                name=str(method["name"]),
                provider_id=int(method["id"]),
            ),
            times=response.timings,
            current_prayer=response.current_prayer,
            next_prayer=response.next_prayer,
            next_prayer_date=response.next_prayer_date,
        )

    def to_api_prayer_calendar_payload(
        self,
        response: PrayerCalendarResponse,
        location: LocationResult,
        *,
        method_id: int,
    ) -> ApiPrayerCalendarPayload:
        method = self.get_method(method_id)
        return ApiPrayerCalendarPayload(
            location=ApiLocation(
                id=location.id,
                city=location.city,
                country=location.country,
                region=location.region,
                lat=location.latitude,
                lng=location.longitude,
                timezone=location.timezone or response.timezone,
            ),
            year=response.year,
            month=response.month,
            method=ApiMethod(
                id=str(method["code"]),
                name=str(method["name"]),
                provider_id=int(method["id"]),
            ),
            days=[
                ApiPrayerCalendarDay(
                    date=day.requested_date.isoformat(),
                    weekday=day.weekday,
                    hijri=day.hijri_date,
                    times=day.timings,
                )
                for day in response.days
            ],
        )

    @classmethod
    def _validate_method(cls, method: int) -> None:
        if method not in cls.ALLOWED_METHODS:
            raise ValueError(
                f"Invalid method={method}. Allowed values: {sorted(cls.ALLOWED_METHODS)}"
            )

    @staticmethod
    def _validate_school(school: int) -> None:
        if school not in {0, 1}:
            raise ValueError("school must be 0 (Standard) or 1 (Hanafi)")


def build_prayer_request(
    latitude: float,
    longitude: float,
    method: int,
    school: int,
    target_date: date,
) -> PrayerRequest:
    return PrayerRequest(
        latitude=latitude,
        longitude=longitude,
        method=method,
        school=school,
        date=target_date,
    )
