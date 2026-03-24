from datetime import date

import httpx

from app.schemas import PrayerDateInfo, PrayerMeta, PrayerRequest, PrayerTimesResponse, PrayerTimings


class PrayerTimesService:
    BASE_URL = "https://api.aladhan.com/v1/timings"
    ALLOWED_METHODS = {0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}

    async def get_prayer_times(self, request: PrayerRequest) -> PrayerTimesResponse:
        self._validate_method(request.method)
        self._validate_school(request.school)

        payload = await self._fetch_timings(request)
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
        url = f"{self.BASE_URL}/{date_str}"
        params = {
            "latitude": request.latitude,
            "longitude": request.longitude,
            "method": request.method,
            "school": request.school,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
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
