import type {
  LocationSearchResponse,
  MethodsResponse,
  PrayerCalendarResponse,
  PrayerTimesResponse,
} from "./types";

interface PrayerBundleParams {
  latitude: number;
  longitude: number;
  method: string;
  school: string;
  today: string;
  tomorrow: string;
  year: number;
  month: number;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = (await response.json()) as {
    error?: { message?: string };
    detail?: string;
  } & T;

  if (!response.ok) {
    const message = payload?.error?.message || payload?.detail || "Не удалось загрузить данные";
    throw new Error(message);
  }

  return payload as T;
}

export function loadMethods(): Promise<MethodsResponse> {
  return fetchJson<MethodsResponse>("/api/v1/config/methods");
}

export function searchCities(query: string, limit = 5): Promise<LocationSearchResponse> {
  return fetchJson<LocationSearchResponse>(`/api/v1/cities/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function reverseLocation(latitude: number, longitude: number): Promise<LocationSearchResponse> {
  return fetchJson<LocationSearchResponse>(`/api/v1/location/reverse?lat=${latitude}&lng=${longitude}`);
}

export function loadPrayerTimesForLocation(params: {
  latitude: number;
  longitude: number;
  method: string;
  school: string;
  date: string;
}): Promise<PrayerTimesResponse> {
  const searchParams = new URLSearchParams({
    lat: String(params.latitude),
    lng: String(params.longitude),
    method: params.method,
    school: params.school,
    date: params.date,
  });
  return fetchJson<PrayerTimesResponse>(`/api/v1/prayer-times/today?${searchParams.toString()}`);
}

export function loadPrayerBundle(
  params: PrayerBundleParams
): Promise<[PrayerTimesResponse, PrayerTimesResponse, PrayerCalendarResponse]> {
  const dailyTodayParams = new URLSearchParams({
    lat: String(params.latitude),
    lng: String(params.longitude),
    method: params.method,
    school: params.school,
    date: params.today,
  });

  const dailyTomorrowParams = new URLSearchParams({
    lat: String(params.latitude),
    lng: String(params.longitude),
    method: params.method,
    school: params.school,
    date: params.tomorrow,
  });

  const monthlyParams = new URLSearchParams({
    lat: String(params.latitude),
    lng: String(params.longitude),
    method: params.method,
    school: params.school,
    year: String(params.year),
    month: String(params.month),
  });

  return Promise.all([
    fetchJson<PrayerTimesResponse>(`/api/v1/prayer-times/today?${dailyTodayParams.toString()}`),
    fetchJson<PrayerTimesResponse>(`/api/v1/prayer-times/today?${dailyTomorrowParams.toString()}`),
    fetchJson<PrayerCalendarResponse>(`/api/v1/prayer-times/monthly?${monthlyParams.toString()}`),
  ]);
}
