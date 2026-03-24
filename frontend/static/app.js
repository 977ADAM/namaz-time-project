const STORAGE_KEYS = {
  selectedCity: "selectedCity",
  calculationMethod: "calculationMethod",
  language: "language",
  theme: "theme",
  timeFormat: "timeFormat",
  school: "school",
};

const DEFAULT_LOCATION = {
  id: "default-moscow",
  city: "Moscow",
  country: "Russia",
  region: "Moscow",
  display_name: "Moscow, Russia",
  latitude: 55.7558,
  longitude: 37.6173,
  timezone: "Europe/Moscow",
};

const PRAYER_LABELS = {
  fajr: "Фаджр",
  sunrise: "Восход",
  dhuhr: "Зухр",
  asr: "Аср",
  maghrib: "Магриб",
  isha: "Иша",
};

const WEEKDAYS = {
  Monday: "Понедельник",
  Tuesday: "Вторник",
  Wednesday: "Среда",
  Thursday: "Четверг",
  Friday: "Пятница",
  Saturday: "Суббота",
  Sunday: "Воскресенье",
};

const state = {
  methods: [],
  location: loadStoredLocation(),
  method: localStorage.getItem(STORAGE_KEYS.calculationMethod) || "2",
  school: localStorage.getItem(STORAGE_KEYS.school) || "0",
  language: localStorage.getItem(STORAGE_KEYS.language) || "ru",
  theme: localStorage.getItem(STORAGE_KEYS.theme) || "system",
  timeFormat: localStorage.getItem(STORAGE_KEYS.timeFormat) || "24h",
  today: null,
  tomorrow: null,
  monthly: null,
  monthlyDate: new Date(),
  debounceTimer: null,
  countdownTimer: null,
  route: window.location.pathname,
};

const elements = {
  cityForm: document.querySelector("#city-form"),
  cityQuery: document.querySelector("#city-query"),
  searchButton: document.querySelector("#search-button"),
  locateButton: document.querySelector("#locate-button"),
  retryButton: document.querySelector("#retry-button"),
  searchStatus: document.querySelector("#search-status"),
  searchResults: document.querySelector("#search-results"),
  status: document.querySelector("#status"),
  todayTitle: document.querySelector("#today-title"),
  todayMeta: document.querySelector("#today-meta"),
  todayTimes: document.querySelector("#today-times"),
  nextPrayerName: document.querySelector("#next-prayer-name"),
  nextPrayerTime: document.querySelector("#next-prayer-time"),
  currentPrayerName: document.querySelector("#current-prayer-name"),
  currentPrayerTime: document.querySelector("#current-prayer-time"),
  countdownValue: document.querySelector("#countdown-value"),
  countdownMeta: document.querySelector("#countdown-meta"),
  locationName: document.querySelector("#location-name"),
  locationMeta: document.querySelector("#location-meta"),
  gregorianDate: document.querySelector("#gregorian-date"),
  hijriDate: document.querySelector("#hijri-date"),
  monthlyTitle: document.querySelector("#monthly-title"),
  monthlyMeta: document.querySelector("#monthly-meta"),
  monthCurrentLabel: document.querySelector("#month-current-label"),
  monthlyBody: document.querySelector("#monthly-body"),
  prevMonthButton: document.querySelector("#prev-month-button"),
  nextMonthButton: document.querySelector("#next-month-button"),
  settingsMethod: document.querySelector("#settings-method"),
  settingsSchool: document.querySelector("#settings-school"),
  settingsLanguage: document.querySelector("#settings-language"),
  settingsTheme: document.querySelector("#settings-theme"),
  settingsTimeFormat: document.querySelector("#settings-time-format"),
  navLinks: Array.from(document.querySelectorAll("[data-nav]")),
  routeSections: Array.from(document.querySelectorAll(".route-section")),
};

function loadStoredLocation() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedCity)) || DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

function saveLocation(location) {
  localStorage.setItem(STORAGE_KEYS.selectedCity, JSON.stringify(location));
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = resolvedTheme;
}

function setRoute(pathname) {
  state.route = pathname;
  elements.routeSections.forEach((section) => {
    section.classList.toggle("active", section.id === `route${pathname === "/" ? "-home" : `-${pathname.slice(1)}`}`);
  });
  elements.navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === pathname);
  });

  const titles = {
    "/": "Времена намаза",
    "/monthly": "Месячное расписание намаза",
    "/settings": "Настройки Namaz Time",
    "/about": "О проекте Namaz Time",
  };
  document.title = titles[pathname] || "Времена намаза";
}

function navigate(pathname) {
  if (window.location.pathname !== pathname) {
    window.history.pushState({}, "", pathname);
  }
  setRoute(pathname);
}

function setSearchStatus(message) {
  elements.searchStatus.textContent = message;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function formatTime(rawTime) {
  if (!rawTime) {
    return "--";
  }

  const [hoursString, minutes] = rawTime.split(":");
  const hours = Number(hoursString);
  if (state.timeFormat === "24h") {
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }
  const suffix = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${minutes} ${suffix}`;
}

function parsePrayerTime(dateString, timeString, timezone) {
  if (!dateString || !timeString || !timezone) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const tzDate = new Date(utcDate.toLocaleString("en-US", { timeZone: timezone }));
  const localDate = new Date(utcDate.toLocaleString("en-US", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  return new Date(utcDate.getTime() - (tzDate.getTime() - localDate.getTime()));
}

function getPrayerMoments(todayPayload, tomorrowPayload) {
  if (!todayPayload?.timings || !todayPayload?.meta?.timezone) {
    return [];
  }

  const timezone = todayPayload.meta.timezone;
  const moments = [
    ["fajr", todayPayload.requested_date, todayPayload.timings.fajr],
    ["dhuhr", todayPayload.requested_date, todayPayload.timings.dhuhr],
    ["asr", todayPayload.requested_date, todayPayload.timings.asr],
    ["maghrib", todayPayload.requested_date, todayPayload.timings.maghrib],
    ["isha", todayPayload.requested_date, todayPayload.timings.isha],
  ];

  if (tomorrowPayload?.timings?.fajr) {
    moments.push(["fajr", tomorrowPayload.requested_date, tomorrowPayload.timings.fajr]);
  }

  return moments
    .map(([key, targetDate, time]) => ({
      key,
      label: PRAYER_LABELS[key],
      time,
      date: targetDate,
      datetime: parsePrayerTime(targetDate, time, timezone),
    }))
    .filter((item) => item.datetime);
}

function getPrayerState() {
  const moments = getPrayerMoments(state.today, state.tomorrow);
  const now = new Date();
  let current = null;
  let next = null;

  moments.forEach((moment) => {
    if (moment.datetime <= now) {
      current = moment;
    } else if (!next) {
      next = moment;
    }
  });

  return { current, next };
}

function startCountdown() {
  window.clearInterval(state.countdownTimer);
  state.countdownTimer = window.setInterval(() => {
    const { current, next } = getPrayerState();

    if (current) {
      elements.currentPrayerName.textContent = current.label;
      elements.currentPrayerTime.textContent = `С ${formatTime(current.time)}`;
    } else {
      elements.currentPrayerName.textContent = "Ещё не наступил";
      elements.currentPrayerTime.textContent = "Первым будет Фаджр";
    }

    if (!next) {
      elements.nextPrayerName.textContent = "Ожидаем следующее обновление";
      elements.nextPrayerTime.textContent = "Нужны данные на следующий день";
      elements.countdownValue.textContent = "--:--:--";
      elements.countdownMeta.textContent = "Нет данных";
      return;
    }

    elements.nextPrayerName.textContent = next.label;
    elements.nextPrayerTime.textContent = `${next.date === state.today.requested_date ? "Сегодня" : "Завтра"} в ${formatTime(next.time)}`;

    const diffMs = next.datetime.getTime() - Date.now();
    if (diffMs <= 0) {
      elements.countdownValue.textContent = "00:00:00";
      elements.countdownMeta.textContent = "Пересчитываем...";
      return;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    elements.countdownValue.textContent = `${hours}:${minutes}:${seconds}`;
    elements.countdownMeta.textContent = "До следующего намаза";
  }, 1000);
}

function renderTodayTimings() {
  elements.todayTimes.innerHTML = "";
  if (!state.today?.timings) {
    elements.todayTimes.innerHTML = `<div class="empty-state">Нет данных для отображения.</div>`;
    return;
  }

  Object.entries(state.today.timings).forEach(([key, rawTime]) => {
    const card = document.createElement("article");
    card.className = "timing-card";
    card.innerHTML = `
      <span class="timing-name">${PRAYER_LABELS[key] || key}</span>
      <strong class="timing-value">${formatTime(rawTime)}</strong>
    `;
    elements.todayTimes.appendChild(card);
  });
}

function renderMonthlyTable() {
  if (!state.monthly?.days?.length) {
    elements.monthlyBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">Нет данных для выбранного месяца.</td>
      </tr>
    `;
    return;
  }

  elements.monthlyBody.innerHTML = "";
  state.monthly.days.forEach((day) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${day.readable_date}</td>
      <td>${WEEKDAYS[day.weekday] || day.weekday}</td>
      <td>${day.hijri_date || "—"}</td>
      <td>${formatTime(day.timings.fajr)}</td>
      <td>${formatTime(day.timings.sunrise)}</td>
      <td>${formatTime(day.timings.dhuhr)}</td>
      <td>${formatTime(day.timings.asr)}</td>
      <td>${formatTime(day.timings.maghrib)}</td>
      <td>${formatTime(day.timings.isha)}</td>
    `;
    elements.monthlyBody.appendChild(row);
  });
}

function renderLocation() {
  elements.locationName.textContent = state.location.display_name;
  const timezone = state.location.timezone || state.today?.meta?.timezone || "timezone не определён";
  elements.locationMeta.textContent = `${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)} • ${timezone}`;
}

function renderDates() {
  elements.gregorianDate.textContent = state.today?.date?.readable || "--";
  elements.hijriDate.textContent = state.today?.date?.hijri?.date || "--";
}

function renderTodayMeta() {
  const methodName = state.today?.meta?.method?.name || "Метод не выбран";
  const timezone = state.today?.meta?.timezone || "Без timezone";
  elements.todayTitle.textContent = state.location.display_name;
  elements.todayMeta.textContent = `${methodName} • ${timezone}`;
}

function renderMonthlyMeta() {
  const formatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
  elements.monthCurrentLabel.textContent = formatter.format(state.monthlyDate);
  elements.monthlyTitle.textContent = `Расписание на ${formatter.format(state.monthlyDate)}`;
  const methodName =
    state.methods.find((item) => String(item.id) === String(state.method))?.name || "Метод не выбран";
  elements.monthlyMeta.textContent = `${state.location.display_name} • ${methodName}`;
}

function renderSearchResults(results) {
  elements.searchResults.innerHTML = "";
  if (!results.length) {
    elements.searchResults.innerHTML = `<div class="empty-state compact">Ничего не найдено. Попробуйте другой запрос.</div>`;
    return;
  }

  results.forEach((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";
    button.innerHTML = `
      <strong>${result.city}</strong>
      <span>${[result.region, result.country].filter(Boolean).join(", ")}</span>
      <small>${result.timezone || "timezone будет определён автоматически"}</small>
    `;
    button.addEventListener("click", async () => {
      await applyLocation(result);
      elements.searchResults.innerHTML = "";
      setSearchStatus("Город выбран.");
    });
    elements.searchResults.appendChild(button);
  });
}

function syncSettings() {
  elements.settingsMethod.innerHTML = state.methods
    .map((method) => `<option value="${method.id}">${method.name}</option>`)
    .join("");
  elements.settingsMethod.value = state.method;
  elements.settingsSchool.value = state.school;
  elements.settingsLanguage.value = state.language;
  elements.settingsTheme.value = state.theme;
  elements.settingsTimeFormat.value = state.timeFormat;
  elements.cityQuery.value = state.location.display_name;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || payload?.detail || "Не удалось загрузить данные";
    throw new Error(message);
  }
  return payload;
}

async function loadMethods() {
  const payload = await fetchJson("/api/v1/config/methods");
  state.methods = payload.methods;
  syncSettings();
}

async function loadPrayerData() {
  const date = new Date();
  const todayValue = date.toISOString().slice(0, 10);
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowValue = tomorrow.toISOString().slice(0, 10);

  const paramsToday = new URLSearchParams({
    lat: String(state.location.latitude),
    lng: String(state.location.longitude),
    method: String(state.method),
    school: String(state.school),
    date: todayValue,
  });

  const paramsTomorrow = new URLSearchParams({
    lat: String(state.location.latitude),
    lng: String(state.location.longitude),
    method: String(state.method),
    school: String(state.school),
    date: tomorrowValue,
  });

  const paramsMonthly = new URLSearchParams({
    lat: String(state.location.latitude),
    lng: String(state.location.longitude),
    method: String(state.method),
    school: String(state.school),
    year: String(state.monthlyDate.getFullYear()),
    month: String(state.monthlyDate.getMonth() + 1),
  });

  setStatus("Загружаем времена намаза...");
  const [todayPayload, tomorrowPayload, monthlyPayload] = await Promise.all([
    fetchJson(`/api/v1/prayer-times/today?${paramsToday.toString()}`),
    fetchJson(`/api/v1/prayer-times/today?${paramsTomorrow.toString()}`),
    fetchJson(`/api/v1/prayer-times/monthly?${paramsMonthly.toString()}`),
  ]);

  state.today = todayPayload;
  state.tomorrow = tomorrowPayload;
  state.monthly = monthlyPayload;
  state.location.timezone = todayPayload.meta?.timezone || state.location.timezone;
  saveLocation(state.location);

  renderLocation();
  renderDates();
  renderTodayMeta();
  renderTodayTimings();
  renderMonthlyMeta();
  renderMonthlyTable();
  startCountdown();
  setStatus("Данные обновлены.");
}

async function applyLocation(location) {
  state.location = {
    ...location,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };
  saveLocation(state.location);
  renderLocation();
  syncSettings();
  await loadPrayerData();
}

async function searchCities(query) {
  const normalized = query.trim();
  if (normalized.length < 2) {
    elements.searchResults.innerHTML = "";
    setSearchStatus("Введите минимум 2 символа.");
    return;
  }

  setSearchStatus("Ищем города...");
  const payload = await fetchJson(`/api/v1/cities/search?q=${encodeURIComponent(normalized)}&limit=5`);
  renderSearchResults(payload.results);
  setSearchStatus(payload.results.length ? "Выберите подходящий вариант." : "Ничего не найдено.");
}

function debounceSearch(query) {
  window.clearTimeout(state.debounceTimer);
  state.debounceTimer = window.setTimeout(() => {
    searchCities(query).catch((error) => setSearchStatus(error.message));
  }, 350);
}

function detectLocation() {
  if (!navigator.geolocation) {
    setSearchStatus("Геолокация недоступна. Используйте ручной поиск.");
    return;
  }

  setSearchStatus("Определяем местоположение...");
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const payload = await fetchJson(
          `/api/v1/location/reverse?lat=${coords.latitude}&lng=${coords.longitude}`
        );
        if (!payload.results.length) {
          throw new Error("Не удалось определить город по координатам.");
        }
        await applyLocation(payload.results[0]);
        setSearchStatus("Местоположение определено.");
      } catch (error) {
        setSearchStatus(error.message);
      }
    },
    () => {
      setSearchStatus("Доступ к геолокации отклонён. Используйте поиск города.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function shiftMonth(offset) {
  state.monthlyDate = new Date(state.monthlyDate.getFullYear(), state.monthlyDate.getMonth() + offset, 1);
  loadPrayerData().catch((error) => setStatus(error.message));
}

function bindEvents() {
  elements.cityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    searchCities(elements.cityQuery.value).catch((error) => setSearchStatus(error.message));
  });

  elements.cityQuery.addEventListener("input", (event) => {
    debounceSearch(event.target.value);
  });

  elements.locateButton.addEventListener("click", detectLocation);
  elements.retryButton.addEventListener("click", () => {
    loadPrayerData().catch((error) => setStatus(error.message));
  });

  elements.prevMonthButton.addEventListener("click", () => shiftMonth(-1));
  elements.nextMonthButton.addEventListener("click", () => shiftMonth(1));

  elements.settingsMethod.addEventListener("change", async (event) => {
    state.method = event.target.value;
    localStorage.setItem(STORAGE_KEYS.calculationMethod, state.method);
    await loadPrayerData();
  });

  elements.settingsSchool.addEventListener("change", async (event) => {
    state.school = event.target.value;
    localStorage.setItem(STORAGE_KEYS.school, state.school);
    await loadPrayerData();
  });

  elements.settingsLanguage.addEventListener("change", (event) => {
    state.language = event.target.value;
    localStorage.setItem(STORAGE_KEYS.language, state.language);
  });

  elements.settingsTheme.addEventListener("change", (event) => {
    setTheme(event.target.value);
  });

  elements.settingsTimeFormat.addEventListener("change", (event) => {
    state.timeFormat = event.target.value;
    localStorage.setItem(STORAGE_KEYS.timeFormat, state.timeFormat);
    renderTodayTimings();
    renderMonthlyTable();
    startCountdown();
  });

  elements.navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.getAttribute("href"));
    });
  });

  window.addEventListener("popstate", () => setRoute(window.location.pathname));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.theme === "system") {
      setTheme("system");
    }
  });
}

async function init() {
  setRoute(window.location.pathname);
  setTheme(state.theme);
  renderLocation();
  bindEvents();
  await loadMethods();
  syncSettings();
  await loadPrayerData();
}

init().catch((error) => {
  setStatus(error.message);
  setSearchStatus(error.message);
});
