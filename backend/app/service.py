from datetime import date
from typing import Any

import httpx

from app.schemas import PrayerDateInfo, PrayerMeta, PrayerTimesResponse, PrayerTimings


class PrayerTimesService:
    BASE_URL = "https://api.aladhan.com/v1/timings"

    async def get_prayer_times(
        self,
        latitude: float,
        longitude: float,
        method: int,
        school: int,
        target_date: date,
    ) -> PrayerTimesResponse:
        self._validate_method(method)
        self._validate_school(school)

        date_str = target_date.strftime("%d-%m-%Y")

        params = {
            "latitude": latitude,
            "longitude": longitude,
            "method": method,
            "school": school,
        }

        url = f"{self.BASE_URL}/{date_str}"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, params=params)
        except httpx.RequestError as e:
            raise RuntimeError(f"Ошибка запроса к внешнему prayer API: {e}") from e

        if response.status_code != 200:
            raise RuntimeError(
                f"Внешний prayer API вернул статус {response.status_code}"
            )

        payload = response.json()

        if payload.get("code") != 200 or "data" not in payload:
            raise RuntimeError("Некорректный ответ от внешнего prayer API")

        data = payload["data"]
        timings_raw = data.get("timings", {})
        date_raw = data.get("date", {})
        meta_raw = data.get("meta", {})

        timings = PrayerTimings(
            fajr=self._clean_time(timings_raw.get("Fajr")),
            sunrise=self._clean_time(timings_raw.get("Sunrise")),
            dhuhr=self._clean_time(timings_raw.get("Dhuhr")),
            asr=self._clean_time(timings_raw.get("Asr")),
            maghrib=self._clean_time(timings_raw.get("Maghrib")),
            isha=self._clean_time(timings_raw.get("Isha")),
        )

        date_info = PrayerDateInfo(
            readable=date_raw.get("readable", ""),
            timestamp=date_raw.get("timestamp", ""),
            gregorian=date_raw.get("gregorian", {}),
            hijri=date_raw.get("hijri", {}),
        )

        meta = PrayerMeta(
            latitude=meta_raw.get("latitude"),
            longitude=meta_raw.get("longitude"),
            timezone=meta_raw.get("timezone", ""),
            method=meta_raw.get("method", {}),
            latitude_adjustment_method=meta_raw.get("latitudeAdjustmentMethod"),
            midnight_mode=meta_raw.get("midnightMode"),
            school=meta_raw.get("school"),
            offset=meta_raw.get("offset"),
        )

        return PrayerTimesResponse(
            timings=timings,
            date=date_info,
            meta=meta,
        )

    @staticmethod
    def _clean_time(value: str | None) -> str:
        if not value:
            return ""
        # Например: "05:12 (+03)" -> "05:12"
        return value.split(" ")[0].strip()

    @staticmethod
    def _validate_method(method: int) -> None:
        allowed_methods = {
            0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
        }
        if method not in allowed_methods:
            raise ValueError(
                f"Недопустимый method={method}. Допустимые значения: {sorted(allowed_methods)}"
            )

    @staticmethod
    def _validate_school(school: int) -> None:
        if school not in {0, 1}:
            raise ValueError("school должен быть 0 или 1")