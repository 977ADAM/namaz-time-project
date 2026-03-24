import unittest
from datetime import date
from unittest.mock import AsyncMock, patch

from app.service import PrayerTimesService, build_prayer_request


class PrayerTimesServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_prayer_times_maps_upstream_payload(self):
        service = PrayerTimesService(cache_ttl_seconds=300)
        request = build_prayer_request(
            latitude=55.7558,
            longitude=37.6173,
            method=2,
            school=0,
            target_date=date(2026, 3, 24),
        )

        upstream_payload = {
            "code": 200,
            "data": {
                "timings": {
                    "Fajr": "04:12 (+03)",
                    "Sunrise": "05:55 (+03)",
                    "Dhuhr": "12:31 (+03)",
                    "Asr": "16:05 (+03)",
                    "Maghrib": "19:04 (+03)",
                    "Isha": "20:42 (+03)",
                },
                "date": {
                    "readable": "24 Mar 2026",
                    "timestamp": "1774306800",
                    "gregorian": {"date": "24-03-2026"},
                    "hijri": {"date": "05-10-1447"},
                },
                "meta": {
                    "latitude": 55.7558,
                    "longitude": 37.6173,
                    "timezone": "Europe/Moscow",
                    "method": {"id": 2, "name": "ISNA"},
                    "latitudeAdjustmentMethod": "ANGLE_BASED",
                    "midnightMode": "STANDARD",
                    "school": "STANDARD",
                    "offset": {"Fajr": 0},
                },
            },
        }

        with patch.object(service, "_fetch_timings", AsyncMock(return_value=upstream_payload)):
            result = await service.get_prayer_times(request)

        self.assertEqual(result.requested_date, date(2026, 3, 24))
        self.assertEqual(result.timings.fajr, "04:12")
        self.assertEqual(result.meta.timezone, "Europe/Moscow")

    async def test_get_prayer_times_uses_cache(self):
        service = PrayerTimesService(cache_ttl_seconds=300)
        request = build_prayer_request(
            latitude=55.7558,
            longitude=37.6173,
            method=2,
            school=0,
            target_date=date(2026, 3, 24),
        )

        upstream_payload = {
            "code": 200,
            "data": {
                "timings": {
                    "Fajr": "04:12 (+03)",
                    "Sunrise": "05:55 (+03)",
                    "Dhuhr": "12:31 (+03)",
                    "Asr": "16:05 (+03)",
                    "Maghrib": "19:04 (+03)",
                    "Isha": "20:42 (+03)",
                },
                "date": {"readable": "24 Mar 2026", "timestamp": "1774306800"},
                "meta": {"latitude": 55.7558, "longitude": 37.6173, "timezone": "Europe/Moscow"},
            },
        }

        with patch.object(service, "_fetch_timings", AsyncMock(return_value=upstream_payload)) as mocked_fetch:
            first = await service.get_prayer_times(request)
            second = await service.get_prayer_times(request)

        self.assertEqual(first.timings.fajr, second.timings.fajr)
        self.assertEqual(mocked_fetch.await_count, 1)

    async def test_get_prayer_times_rejects_invalid_method(self):
        service = PrayerTimesService()
        request = build_prayer_request(
            latitude=55.7558,
            longitude=37.6173,
            method=99,
            school=0,
            target_date=date(2026, 3, 24),
        )

        with self.assertRaisesRegex(ValueError, "Invalid method"):
            await service.get_prayer_times(request)
