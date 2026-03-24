const form = document.querySelector("#prayer-form");
const cityInput = document.querySelector("#city-query");
const dateInput = document.querySelector("#date-input");
const latitudeInput = document.querySelector("#latitude-input");
const longitudeInput = document.querySelector("#longitude-input");
const methodSelect = document.querySelector("#method-select");
const schoolSelect = document.querySelector("#school-select");
const locateButton = document.querySelector("#locate-button");
const statusEl = document.querySelector("#status");
const titleEl = document.querySelector("#result-title");
const metaEl = document.querySelector("#result-meta");
const timingsEl = document.querySelector("#timings");
const searchResultsEl = document.querySelector("#search-results");
const nextPrayerNameEl = document.querySelector("#next-prayer-name");
const nextPrayerTimeEl = document.querySelector("#next-prayer-time");
const locationNameEl = document.querySelector("#location-name");
const locationCoordinatesEl = document.querySelector("#location-coordinates");
const methodNameEl = document.querySelector("#method-name");
const timezoneNameEl = document.querySelector("#timezone-name");
const calendarTitleEl = document.querySelector("#calendar-title");
const calendarMetaEl = document.querySelector("#calendar-meta");
const calendarBodyEl = document.querySelector("#calendar-body");

const today = new Date();
dateInput.value = today.toISOString().slice(0, 10);

const prayerLabels = {
  fajr: "Фаджр",
  sunrise: "Восход",
  dhuhr: "Зухр",
  asr: "Аср",
  maghrib: "Магриб",
  isha: "Иша",
};

let selectedLocation = {
  city: "Moscow",
  country: "Russia",
  display_name: "Moscow, Russia",
  latitude: 55.7558,
  longitude: 37.6173,
};

function setStatus(message) {
  statusEl.textContent = message;
}

function renderSearchResults(results) {
  searchResultsEl.innerHTML = "";
  if (!results.length) {
    searchResultsEl.innerHTML = `<div class="search-empty">Ничего не найдено. Попробуйте указать город на английском.</div>`;
    return;
  }

  results.forEach((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";
    button.innerHTML = `
      <strong>${result.city}</strong>
      <span>${result.country || result.display_name}</span>
    `;
    button.addEventListener("click", () => applyLocation(result, true));
    searchResultsEl.appendChild(button);
  });
}

function renderTimings(timings) {
  timingsEl.innerHTML = "";

  Object.entries(timings).forEach(([key, value]) => {
    const card = document.createElement("article");
    card.className = "timing-card";
    card.innerHTML = `
      <span class="timing-name">${prayerLabels[key] || key}</span>
      <span class="timing-value">${value}</span>
    `;
    timingsEl.appendChild(card);
  });
}

function renderCalendar(days) {
  calendarBodyEl.innerHTML = "";

  if (!days.length) {
    calendarBodyEl.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">Нет данных для выбранного месяца.</td>
      </tr>
    `;
    return;
  }

  days.forEach((day) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${day.readable_date}</td>
      <td>${day.hijri_date || "—"}</td>
      <td>${day.timings.fajr}</td>
      <td>${day.timings.sunrise}</td>
      <td>${day.timings.dhuhr}</td>
      <td>${day.timings.asr}</td>
      <td>${day.timings.maghrib}</td>
      <td>${day.timings.isha}</td>
    `;
    calendarBodyEl.appendChild(row);
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail || "Не удалось загрузить данные");
  }
  return payload;
}

async function searchLocations(query) {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    searchResultsEl.innerHTML = "";
    return;
  }

  setStatus("Ищем подходящие города...");
  const payload = await fetchJson(`/v1/locations/search?q=${encodeURIComponent(trimmedQuery)}`);
  renderSearchResults(payload.results);
  setStatus("Выберите подходящий город из списка.");
}

async function loadPrayerData() {
  const params = new URLSearchParams({
    latitude: latitudeInput.value,
    longitude: longitudeInput.value,
    date: dateInput.value,
    method: methodSelect.value,
    school: schoolSelect.value,
  });

  const monthDate = new Date(`${dateInput.value}T12:00:00`);
  const calendarParams = new URLSearchParams({
    latitude: latitudeInput.value,
    longitude: longitudeInput.value,
    method: methodSelect.value,
    school: schoolSelect.value,
    year: String(monthDate.getFullYear()),
    month: String(monthDate.getMonth() + 1),
  });

  setStatus("Загружаем времена намаза и календарь...");

  const [dailyPayload, calendarPayload] = await Promise.all([
    fetchJson(`/v1/prayer-times?${params.toString()}`),
    fetchJson(`/v1/prayer-calendar?${calendarParams.toString()}`),
  ]);

  titleEl.textContent = dailyPayload.date.readable || dailyPayload.requested_date;
  metaEl.textContent = `${selectedLocation.display_name} • ${dailyPayload.meta.timezone}`;
  methodNameEl.textContent = dailyPayload.meta.method?.name || methodSelect.options[methodSelect.selectedIndex].text;
  timezoneNameEl.textContent = dailyPayload.meta.timezone || "Часовой пояс не определён";
  locationNameEl.textContent = selectedLocation.display_name;
  locationCoordinatesEl.textContent = `${Number(latitudeInput.value).toFixed(4)}, ${Number(longitudeInput.value).toFixed(4)}`;

  if (dailyPayload.next_prayer) {
    nextPrayerNameEl.textContent = dailyPayload.next_prayer.label;
    nextPrayerTimeEl.textContent = `Сегодня в ${dailyPayload.next_prayer.time}`;
  } else {
    nextPrayerNameEl.textContent = "На сегодня все намазы завершены";
    nextPrayerTimeEl.textContent = "Следующий день начнётся с Фаджра";
  }

  renderTimings(dailyPayload.timings);
  renderCalendar(calendarPayload.days);

  calendarTitleEl.textContent = `Расписание на ${monthDate.toLocaleString("ru-RU", { month: "long", year: "numeric" })}`;
  calendarMetaEl.textContent = `${selectedLocation.display_name} • метод ${methodNameEl.textContent}`;
  setStatus("Данные обновлены.");
}

async function applyLocation(result, shouldLoad = false) {
  selectedLocation = result;
  cityInput.value = result.display_name;
  latitudeInput.value = result.latitude;
  longitudeInput.value = result.longitude;
  searchResultsEl.innerHTML = "";

  if (shouldLoad) {
    await loadPrayerData();
  } else {
    locationNameEl.textContent = result.display_name;
    locationCoordinatesEl.textContent = `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`;
  }
}

async function handleSearchSubmit(event) {
  event.preventDefault();
  try {
    await searchLocations(cityInput.value);
  } catch (error) {
    setStatus(error.message);
  }
}

async function detectLocation() {
  if (!navigator.geolocation) {
    setStatus("Браузер не поддерживает геолокацию.");
    return;
  }

  setStatus("Определяем ваше местоположение...");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const payload = await fetchJson(`/v1/locations/reverse?latitude=${latitude}&longitude=${longitude}`);
        const [result] = payload.results;
        await applyLocation(result, true);
      } catch (error) {
        setStatus(error.message);
      }
    },
    () => {
      setStatus("Не удалось определить местоположение. Попробуйте поиск по городу.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function reloadCurrentLocation() {
  if (!latitudeInput.value || !longitudeInput.value) {
    return;
  }

  try {
    await loadPrayerData();
  } catch (error) {
    setStatus(error.message);
  }
}

form.addEventListener("submit", handleSearchSubmit);
locateButton.addEventListener("click", detectLocation);
methodSelect.addEventListener("change", reloadCurrentLocation);
schoolSelect.addEventListener("change", reloadCurrentLocation);

applyLocation(selectedLocation);
loadPrayerData().catch((error) => {
  setStatus(error.message);
});
