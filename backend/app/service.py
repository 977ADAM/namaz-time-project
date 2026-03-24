import logging
from datetime import date
from time import monotonic

import httpx

from app.config import settings
from app.schemas import PrayerDateInfo, PrayerMeta, PrayerRequest, PrayerTimesResponse, PrayerTimings

logger = logging.getLogger(__name__)


class PrayerTimesService:
    ALLOWED_METHODS = {0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}

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
        self._client: httpx.AsyncClient | None = None
        self._cache: dict[tuple[float, float, int, int, str], tuple[float, PrayerTimesResponse]] = {}

    async def get_prayer_times(self, request: PrayerRequest) -> PrayerTimesResponse:
        self._validate_method(request.method)
        self._validate_school(request.school)

        cache_key = self._build_cache_key(request)
        cached = self._get_cached(cache_key)
        if cached is not None:
            logger.debug("Serving prayer times from cache", extra={"cache_key": cache_key})
            return cached

        payload = await self._fetch_timings(request)
        result = self._map_payload(request, payload)
        self._cache_response(cache_key, result)
        return result

    async def check_ready(self) -> bool:
        try:
            await self._get_client()
        except RuntimeError:
            return False
        return True

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout_seconds)
        return self._client

    def _map_payload(self, request: PrayerRequest, payload: dict) -> PrayerTimesResponse:
        data = payload["data"]
        timings_raw = data.get("timings") or {}
        date_raw = data.get("date") or {}
        meta_raw = data.get("meta") or {}

        return PrayerTimesResponse(
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

    @staticmethod
    def _clean_time(value: str | None) -> str:
        if not value:
            return ""
        return value.split(" ")[0].strip()

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
