import unittest
from datetime import date
from unittest.mock import AsyncMock, patch

import httpx

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
        transport = httpx.ASGITransport(app=app)
        self.client = httpx.AsyncClient(transport=transport, base_url="http://testserver")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_health_endpoint(self):
        response = await self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertIn("X-Process-Time-Ms", response.headers)

    async def test_ready_endpoint(self):
        with patch("app.main.service.check_ready", AsyncMock(return_value=True)):
            response = await self.client.get("/ready")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    async def test_meta_endpoint(self):
        response = await self.client.get("/v1/meta")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["openapi_url"], "/openapi.json")

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
