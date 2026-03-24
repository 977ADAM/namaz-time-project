import { reverseLocation, loadMethods, loadPrayerBundle, searchCities } from "./api.js";
import { STORAGE_KEYS } from "./constants.js";
import { getElements } from "./dom.js";
import { formatTime } from "./formatters.js";
import { getPrayerState } from "./prayer.js";
import {
  renderDates,
  renderLocation,
  renderMonthlyMeta,
  renderMonthlyTable,
  renderSearchResults,
  renderTodayMeta,
  renderTodayTimings,
  setSearchStatus,
  setStatus,
  syncSettings,
} from "./render.js";
import { navigate, setRoute } from "./router.js";
import { createAppState } from "./state.js";
import { saveLocation, writeSetting } from "./storage.js";

const state = createAppState();
const elements = getElements();

function setTheme(theme) {
  state.theme = theme;
  writeSetting(STORAGE_KEYS.theme, theme);
  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = resolvedTheme;
}

function renderAll() {
  renderLocation(state, elements);
  renderDates(state, elements);
  renderTodayMeta(state, elements);
  renderTodayTimings(state, elements);
  renderMonthlyMeta(state, elements);
  renderMonthlyTable(state, elements);
  syncSettings(state, elements);
}

function updateCountdown() {
  const { current, next } = getPrayerState(state.today, state.tomorrow);

  if (current) {
    elements.currentPrayerName.textContent = current.label;
    elements.currentPrayerTime.textContent = `С ${formatTime(current.time, state.timeFormat)}`;
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
  elements.nextPrayerTime.textContent = `${next.date === state.today.requested_date ? "Сегодня" : "Завтра"} в ${formatTime(next.time, state.timeFormat)}`;

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
}

function startCountdown() {
  window.clearInterval(state.countdownTimer);
  updateCountdown();
  state.countdownTimer = window.setInterval(updateCountdown, 1000);
}

async function loadPrayerData() {
  const currentDate = new Date();
  const todayValue = currentDate.toISOString().slice(0, 10);
  const tomorrowDate = new Date(currentDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowValue = tomorrowDate.toISOString().slice(0, 10);

  setStatus(elements, "Загружаем времена намаза...");
  const [todayPayload, tomorrowPayload, monthlyPayload] = await loadPrayerBundle({
    latitude: state.location.latitude,
    longitude: state.location.longitude,
    method: state.method,
    school: state.school,
    today: todayValue,
    tomorrow: tomorrowValue,
    year: state.monthlyDate.getFullYear(),
    month: state.monthlyDate.getMonth() + 1,
  });

  state.today = todayPayload;
  state.tomorrow = tomorrowPayload;
  state.monthly = monthlyPayload;
  state.location.timezone = todayPayload.meta?.timezone || state.location.timezone;
  saveLocation(state.location);

  renderAll();
  startCountdown();
  setStatus(elements, "Данные обновлены.");
}

async function applyLocation(location) {
  state.location = {
    ...location,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };
  saveLocation(state.location);
  renderLocation(state, elements);
  syncSettings(state, elements);
  await loadPrayerData();
}

async function handleSearch(query) {
  const normalized = query.trim();
  if (normalized.length < 2) {
    elements.searchResults.innerHTML = "";
    setSearchStatus(elements, "Введите минимум 2 символа.");
    return;
  }

  setSearchStatus(elements, "Ищем города...");
  const payload = await searchCities(normalized, 5);
  renderSearchResults(payload.results, elements, async (result) => {
    await applyLocation(result);
    elements.searchResults.innerHTML = "";
    setSearchStatus(elements, "Город выбран.");
  });
  setSearchStatus(elements, payload.results.length ? "Выберите подходящий вариант." : "Ничего не найдено.");
}

function debounceSearch(query) {
  window.clearTimeout(state.debounceTimer);
  state.debounceTimer = window.setTimeout(() => {
    handleSearch(query).catch((error) => setSearchStatus(elements, error.message));
  }, 350);
}

function detectLocation() {
  if (!navigator.geolocation) {
    setSearchStatus(elements, "Геолокация недоступна. Используйте ручной поиск.");
    return;
  }

  setSearchStatus(elements, "Определяем местоположение...");
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const payload = await reverseLocation(coords.latitude, coords.longitude);
        if (!payload.results.length) {
          throw new Error("Не удалось определить город по координатам.");
        }
        await applyLocation(payload.results[0]);
        setSearchStatus(elements, "Местоположение определено.");
      } catch (error) {
        setSearchStatus(elements, error.message);
      }
    },
    () => {
      setSearchStatus(elements, "Доступ к геолокации отклонён. Используйте поиск города.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function shiftMonth(offset) {
  state.monthlyDate = new Date(state.monthlyDate.getFullYear(), state.monthlyDate.getMonth() + offset, 1);
  loadPrayerData().catch((error) => setStatus(elements, error.message));
}

function bindEvents() {
  elements.cityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSearch(elements.cityQuery.value).catch((error) => setSearchStatus(elements, error.message));
  });

  elements.cityQuery.addEventListener("input", (event) => {
    debounceSearch(event.target.value);
  });

  elements.locateButton.addEventListener("click", detectLocation);
  elements.retryButton.addEventListener("click", () => {
    loadPrayerData().catch((error) => setStatus(elements, error.message));
  });
  elements.prevMonthButton.addEventListener("click", () => shiftMonth(-1));
  elements.nextMonthButton.addEventListener("click", () => shiftMonth(1));

  elements.settingsMethod.addEventListener("change", async (event) => {
    state.method = event.target.value;
    writeSetting(STORAGE_KEYS.calculationMethod, state.method);
    await loadPrayerData();
  });

  elements.settingsSchool.addEventListener("change", async (event) => {
    state.school = event.target.value;
    writeSetting(STORAGE_KEYS.school, state.school);
    await loadPrayerData();
  });

  elements.settingsLanguage.addEventListener("change", (event) => {
    state.language = event.target.value;
    writeSetting(STORAGE_KEYS.language, state.language);
  });

  elements.settingsTheme.addEventListener("change", (event) => {
    setTheme(event.target.value);
    syncSettings(state, elements);
  });

  elements.settingsTimeFormat.addEventListener("change", (event) => {
    state.timeFormat = event.target.value;
    writeSetting(STORAGE_KEYS.timeFormat, state.timeFormat);
    renderTodayTimings(state, elements);
    renderMonthlyTable(state, elements);
    updateCountdown();
  });

  elements.navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.getAttribute("href"), elements);
    });
  });

  window.addEventListener("popstate", () => setRoute(window.location.pathname, elements));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.theme === "system") {
      setTheme("system");
    }
  });
}

export async function initApp() {
  try {
    setRoute(window.location.pathname, elements);
    setTheme(state.theme);
    renderLocation(state, elements);
    bindEvents();

    const methodsPayload = await loadMethods();
    state.methods = methodsPayload.methods;
    syncSettings(state, elements);

    await loadPrayerData();
  } catch (error) {
    setStatus(elements, error.message);
    setSearchStatus(elements, error.message);
  }
}
