import unittest
from dataclasses import replace
from datetime import date
from unittest.mock import AsyncMock, patch

import httpx

from app.config import settings as base_settings
from app.errors import UpstreamBadResponseError, UpstreamTimeoutError
from app.main import app
from app.schemas import (
    LocationResult,
    PrayerCalendarDay,
    PrayerCalendarResponse,
    PrayerDateInfo,
    PrayerMeta,
    PrayerNameValue,
    PrayerTimesResponse,
    PrayerTimings,
)


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        self.client = httpx.AsyncClient(transport=transport, base_url="http://testserver")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_health_endpoint(self):
        response = await self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertIn("X-Process-Time-Ms", response.headers)

    async def test_ready_endpoint(self):
        with patch("app.main.service.check_ready", AsyncMock(return_value=False)) as mocked_check:
            response = await self.client.get("/ready")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["checks"]["upstream_client"], "unknown")
        mocked_check.assert_not_awaited()

    async def test_ready_deep_endpoint_checks_cached_upstream_status(self):
        with patch("app.main.service.check_ready", AsyncMock(return_value=True)) as mocked_check:
            response = await self.client.get("/ready/deep")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["checks"]["upstream_client"], "ok")
        mocked_check.assert_awaited_once()

    async def test_meta_endpoint(self):
        response = await self.client.get("/v1/meta")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["openapi_url"], "/openapi.json")

    async def test_metrics_endpoint(self):
        with patch("app.main.settings", replace(base_settings, metrics_enabled=True)):
            response = await self.client.get("/metrics")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("cache", body)
        self.assertIn("rate_limit", body)
        self.assertIn("enabled", body["rate_limit"])

    async def test_metrics_endpoint_returns_404_when_disabled(self):
        with patch("app.main.settings", replace(base_settings, metrics_enabled=False)):
            response = await self.client.get("/metrics")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "NOT_FOUND")

    async def test_root_serves_frontend(self):
        response = await self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Времена намаза", response.text)

    async def test_prayer_times_endpoint(self):
        mocked_response = PrayerTimesResponse(
            requested_date=date(2026, 3, 24),
            timings=PrayerTimings(
                fajr="04:12",
                sunrise="05:55",
                dhuhr="12:31",
                asr="16:05",
                maghrib="19:04",
                isha="20:42",
            ),
            date=PrayerDateInfo(
                readable="24 Mar 2026",
                timestamp="1774306800",
                gregorian={"date": "24-03-2026"},
                hijri={"date": "05-10-1447"},
            ),
            meta=PrayerMeta(
                latitude=55.7558,
                longitude=37.6173,
                timezone="Europe/Moscow",
                method={"id": 2, "name": "ISNA"},
                latitudeAdjustmentMethod="ANGLE_BASED",
                midnightMode="STANDARD",
                school="STANDARD",
                offset={"Fajr": 0},
            ),
            current_prayer=PrayerNameValue(key="maghrib", label="Магриб", time="19:04"),
            next_prayer=PrayerNameValue(key="isha", label="Иша", time="20:42"),
            next_prayer_date=date(2026, 3, 24),
        )

        with patch("app.main.service.get_prayer_times", AsyncMock(return_value=mocked_response)):
            response = await self.client.get(
                "/v1/prayer-times",
                params={
                    "latitude": 55.7558,
                    "longitude": 37.6173,
                    "date": "2026-03-24",
                    "method": 2,
                    "school": 0,
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["requested_date"], "2026-03-24")
        self.assertEqual(body["timings"]["isha"], "20:42")
        self.assertEqual(body["next_prayer"]["key"], "isha")

    async def test_api_prayer_times_today_endpoint_returns_normalized_payload(self):
        location = LocationResult(
            id="geo_1",
            city="Moscow",
            country="Russia",
            region="Moscow",
            display_name="Moscow, Russia",
            latitude=55.7558,
            longitude=37.6173,
            timezone="Europe/Moscow",
        )
        legacy_payload = PrayerTimesResponse(
            requested_date=date(2026, 3, 24),
            timings=PrayerTimings(
                fajr="04:12",
                sunrise="05:55",
                dhuhr="12:31",
                asr="16:05",
                maghrib="19:04",
                isha="20:42",
            ),
            date=PrayerDateInfo(
                readable="24 Mar 2026",
                timestamp="1774306800",
                gregorian={"date": "24-03-2026"},
                hijri={"date": "05-10-1447"},
            ),
            meta=PrayerMeta(
                latitude=55.7558,
                longitude=37.6173,
                timezone="Europe/Moscow",
                method={"id": 2, "name": "ISNA"},
            ),
            current_prayer=PrayerNameValue(key="maghrib", label="Магриб", time="19:04"),
            next_prayer=PrayerNameValue(key="isha", label="Иша", time="20:42"),
            next_prayer_date=date(2026, 3, 24),
        )

        with (
            patch("app.main.service.resolve_location", AsyncMock(return_value=location)),
            patch("app.main.service.get_prayer_times", AsyncMock(return_value=legacy_payload)),
        ):
            response = await self.client.get(
                "/api/v1/prayer-times/today",
                params={"city": "Moscow", "country": "Russia", "date": "2026-03-24", "method": 2},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["location"]["city"], "Moscow")
        self.assertEqual(body["date"]["gregorian"], "2026-03-24")
        self.assertEqual(body["method"]["id"], "ISNA")
        self.assertEqual(body["times"]["isha"], "20:42")

    async def test_prayer_calendar_endpoint(self):
        mocked_response = PrayerCalendarResponse(
            year=2026,
            month=3,
            timezone="Europe/Moscow",
            method={"id": 2, "name": "ISNA"},
            days=[
                PrayerCalendarDay(
                    requested_date=date(2026, 3, 24),
                    readable_date="24 Mar 2026",
                    hijri_date="05-10-1447",
                    weekday="Tuesday",
                    timings=PrayerTimings(
                        fajr="04:12",
                        sunrise="05:55",
                        dhuhr="12:31",
                        asr="16:05",
                        maghrib="19:04",
                        isha="20:42",
                    ),
                )
            ],
        )

        with patch("app.main.service.get_prayer_calendar", AsyncMock(return_value=mocked_response)):
            response = await self.client.get(
                "/v1/prayer-calendar",
                params={
                    "latitude": 55.7558,
                    "longitude": 37.6173,
                    "method": 2,
                    "school": 0,
                    "year": 2026,
                    "month": 3,
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["month"], 3)
        self.assertEqual(body["days"][0]["timings"]["fajr"], "04:12")

    async def test_api_prayer_times_monthly_endpoint_returns_normalized_payload(self):
        location = LocationResult(
            id="geo_1",
            city="Moscow",
            country="Russia",
            region="Moscow",
            display_name="Moscow, Russia",
            latitude=55.7558,
            longitude=37.6173,
            timezone="Europe/Moscow",
        )
        legacy_payload = PrayerCalendarResponse(
            year=2026,
            month=3,
            timezone="Europe/Moscow",
            method={"id": 2, "name": "ISNA"},
            days=[
                PrayerCalendarDay(
                    requested_date=date(2026, 3, 24),
                    readable_date="24 Mar 2026",
                    hijri_date="05-10-1447",
                    weekday="Tuesday",
                    timings=PrayerTimings(
                        fajr="04:12",
                        sunrise="05:55",
                        dhuhr="12:31",
                        asr="16:05",
                        maghrib="19:04",
                        isha="20:42",
                    ),
                )
            ],
        )

        with (
            patch("app.main.service.resolve_location", AsyncMock(return_value=location)),
            patch("app.main.service.get_prayer_calendar", AsyncMock(return_value=legacy_payload)),
        ):
            response = await self.client.get(
                "/api/v1/prayer-times/monthly",
                params={"lat": 55.7558, "lng": 37.6173, "year": 2026, "month": 3, "method": 2},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["location"]["timezone"], "Europe/Moscow")
        self.assertEqual(body["method"]["name"], "Islamic Society of North America")
        self.assertEqual(body["days"][0]["times"]["fajr"], "04:12")

    async def test_location_search_endpoint(self):
        mocked_locations = [
            LocationResult(
                id="geo_1",
                city="Moscow",
                country="Russia",
                region="Moscow",
                display_name="Moscow, Russia",
                latitude=55.7558,
                longitude=37.6173,
            )
        ]

        with patch("app.main.service.search_locations", AsyncMock(return_value=mocked_locations)):
            response = await self.client.get("/v1/locations/search", params={"q": "Moscow"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"][0]["city"], "Moscow")

    async def test_methods_endpoint(self):
        response = await self.client.get("/api/v1/config/methods")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.json()["methods"]) >= 7)
        self.assertIn("X-RateLimit-Remaining", response.headers)
        self.assertIn("X-RateLimit-Reset", response.headers)

    async def test_rate_limit_returns_429(self):
        with patch("app.main.rate_limiter.check") as mocked_check:
            from app.rate_limit import RateLimitResult

            mocked_check.return_value = RateLimitResult(allowed=False, remaining=0, reset_after_seconds=7)
            response = await self.client.get("/api/v1/config/methods")

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["error"]["code"], "RATE_LIMITED")
        self.assertEqual(response.headers["Retry-After"], "7")

    async def test_unhandled_exception_returns_internal_error(self):
        with patch("app.main.service.search_locations", AsyncMock(side_effect=Exception("boom"))):
            response = await self.client.get("/api/v1/cities/search", params={"q": "Moscow"})

        self.assertEqual(response.status_code, 500)
        body = response.json()
        self.assertEqual(body["error"]["code"], "INTERNAL_ERROR")
        self.assertIn("request_id", body["error"]["details"])

    async def test_typed_upstream_timeout_returns_normalized_api_error(self):
        with patch(
            "app.main.service.search_locations",
            AsyncMock(side_effect=UpstreamTimeoutError("Location search timed out")),
        ):
            response = await self.client.get("/api/v1/cities/search", params={"q": "Moscow"})

        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.json()["error"]["code"], "UPSTREAM_TIMEOUT")

    async def test_typed_upstream_bad_response_returns_normalized_api_error(self):
        with patch(
            "app.main.service.search_locations",
            AsyncMock(side_effect=UpstreamBadResponseError("Unexpected upstream payload")),
        ):
            response = await self.client.get("/api/v1/cities/search", params={"q": "Moscow"})

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"]["code"], "UPSTREAM_BAD_RESPONSE")
