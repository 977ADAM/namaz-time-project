export async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || payload?.detail || "Не удалось загрузить данные";
    throw new Error(message);
  }
  return payload;
}

export function loadMethods() {
  return fetchJson("/api/v1/config/methods");
}

export function searchCities(query, limit = 5) {
  return fetchJson(`/api/v1/cities/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function reverseLocation(latitude, longitude) {
  return fetchJson(`/api/v1/location/reverse?lat=${latitude}&lng=${longitude}`);
}

export function loadPrayerBundle({ latitude, longitude, method, school, today, tomorrow, year, month }) {
  const dailyTodayParams = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    method: String(method),
    school: String(school),
    date: today,
  });

  const dailyTomorrowParams = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    method: String(method),
    school: String(school),
    date: tomorrow,
  });

  const monthlyParams = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    method: String(method),
    school: String(school),
    year: String(year),
    month: String(month),
  });

  return Promise.all([
    fetchJson(`/api/v1/prayer-times/today?${dailyTodayParams.toString()}`),
    fetchJson(`/api/v1/prayer-times/today?${dailyTomorrowParams.toString()}`),
    fetchJson(`/api/v1/prayer-times/monthly?${monthlyParams.toString()}`),
  ]);
}
