import unittest
from datetime import date, datetime
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

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

        mocked_now = datetime(2026, 3, 24, 20, 0, tzinfo=ZoneInfo("Europe/Moscow"))

        with (
            patch.object(service, "_fetch_timings", AsyncMock(return_value=upstream_payload)),
            patch("app.service.datetime") as mocked_datetime,
        ):
            mocked_datetime.now.return_value = mocked_now
            mocked_datetime.combine.side_effect = datetime.combine
            mocked_datetime.strptime.side_effect = datetime.strptime
            mocked_datetime.min = datetime.min
            result = await service.get_prayer_times(request)

        self.assertEqual(result.requested_date, date(2026, 3, 24))
        self.assertEqual(result.timings.fajr, "04:12")
        self.assertEqual(result.meta.timezone, "Europe/Moscow")
        self.assertEqual(result.next_prayer.label, "Иша")

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

    async def test_get_prayer_calendar_maps_payload(self):
        service = PrayerTimesService(cache_ttl_seconds=300)
        upstream_payload = {
            "code": 200,
            "data": [
                {
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
                        "gregorian": {"date": "24-03-2026"},
                        "hijri": {"date": "05-10-1447"},
                    },
                    "meta": {
                        "timezone": "Europe/Moscow",
                        "method": {"id": 2, "name": "ISNA"},
                    },
                }
            ],
        }

        with patch.object(service, "_fetch_calendar", AsyncMock(return_value=upstream_payload)):
            result = await service.get_prayer_calendar(
                latitude=55.7558,
                longitude=37.6173,
                method=2,
                school=0,
                year=2026,
                month=3,
            )

        self.assertEqual(result.month, 3)
        self.assertEqual(result.timezone, "Europe/Moscow")
        self.assertEqual(result.days[0].timings.maghrib, "19:04")

    async def test_check_ready_probes_upstream(self):
        service = PrayerTimesService()

        with patch.object(service, "_fetch_timings", AsyncMock(return_value={"code": 200, "data": {}})) as mocked_fetch:
            result = await service.check_ready()

        self.assertTrue(result)
        self.assertEqual(mocked_fetch.await_count, 1)

    async def test_check_ready_returns_false_when_upstream_fails(self):
        service = PrayerTimesService()

        with patch.object(service, "_fetch_timings", AsyncMock(side_effect=RuntimeError("boom"))):
            result = await service.check_ready()

        self.assertFalse(result)

    async def test_get_prayer_times_uses_next_day_fajr_after_isha(self):
        service = PrayerTimesService(cache_ttl_seconds=300)
        request = build_prayer_request(
            latitude=55.7558,
            longitude=37.6173,
            method=2,
            school=0,
            target_date=date(2026, 3, 24),
        )

        today_payload = {
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
                },
            },
        }
        tomorrow_payload = {
            "code": 200,
            "data": {
                "timings": {
                    "Fajr": "04:10 (+03)",
                    "Sunrise": "05:53 (+03)",
                    "Dhuhr": "12:30 (+03)",
                    "Asr": "16:06 (+03)",
                    "Maghrib": "19:06 (+03)",
                    "Isha": "20:44 (+03)",
                },
                "date": {
                    "readable": "25 Mar 2026",
                    "timestamp": "1774393200",
                    "gregorian": {"date": "25-03-2026"},
                    "hijri": {"date": "06-10-1447"},
                },
                "meta": {
                    "latitude": 55.7558,
                    "longitude": 37.6173,
                    "timezone": "Europe/Moscow",
                    "method": {"id": 2, "name": "ISNA"},
                },
            },
        }
        mocked_now = datetime(2026, 3, 24, 21, 30, tzinfo=ZoneInfo("Europe/Moscow"))

        with (
            patch.object(service, "_fetch_timings", AsyncMock(side_effect=[today_payload, tomorrow_payload])) as mocked_fetch,
            patch("app.service.datetime") as mocked_datetime,
        ):
            mocked_datetime.now.return_value = mocked_now
            mocked_datetime.combine.side_effect = datetime.combine
            mocked_datetime.strptime.side_effect = datetime.strptime
            mocked_datetime.min = datetime.min
            result = await service.get_prayer_times(request)

        self.assertEqual(mocked_fetch.await_count, 2)
        self.assertEqual(result.current_prayer.key, "isha")
        self.assertEqual(result.next_prayer.key, "fajr")
        self.assertEqual(result.next_prayer.time, "04:10")
        self.assertEqual(result.next_prayer_date, date(2026, 3, 25))

    async def test_get_prayer_times_before_fajr_has_no_current_prayer(self):
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
                },
            },
        }
        mocked_now = datetime(2026, 3, 24, 3, 30, tzinfo=ZoneInfo("Europe/Moscow"))

        with (
            patch.object(service, "_fetch_timings", AsyncMock(return_value=upstream_payload)),
            patch("app.service.datetime") as mocked_datetime,
        ):
            mocked_datetime.now.return_value = mocked_now
            mocked_datetime.combine.side_effect = datetime.combine
            mocked_datetime.strptime.side_effect = datetime.strptime
            mocked_datetime.min = datetime.min
            result = await service.get_prayer_times(request)

        self.assertIsNone(result.current_prayer)
        self.assertEqual(result.next_prayer.key, "fajr")
        self.assertEqual(result.next_prayer_date, date(2026, 3, 24))
