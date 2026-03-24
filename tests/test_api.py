import unittest
from datetime import date
from unittest.mock import AsyncMock, patch

import httpx

from app.main import app
from app.schemas import PrayerDateInfo, PrayerMeta, PrayerTimesResponse, PrayerTimings


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
        self.assertIn("Namaz Time API", response.text)

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
