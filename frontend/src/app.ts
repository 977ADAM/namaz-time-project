import { reverseLocation, loadMethods, loadPrayerBundle, searchCities } from "./api";
import { STORAGE_KEYS } from "./constants";
import type { AppElements } from "./dom";
import { getElements } from "./dom";
import { formatTime } from "./formatters";
import { getPrayerState } from "./prayer";
import {
  renderFavoriteCities,
  renderFavoriteToggle,
  renderHeroState,
  renderDates,
  renderLocation,
  renderMonthlyMeta,
  renderMonthlyTable,
  renderNotifications,
  renderSearchResults,
  renderTodayMeta,
  renderTodayTimings,
  setSearchStatus,
  setStatus,
  syncSettings,
} from "./render";
import { navigate, setRoute } from "./router";
import { createAppState, type AppState } from "./state";
import { saveFavoriteLocations, saveLocation, writeSetting } from "./storage";
import type { LocationResult, PrayerMoment } from "./types";

export function initApp(): void {
  const state = createAppState();
  const elements = getElements();

  void bootstrap(state, elements);
}

async function bootstrap(state: AppState, elements: AppElements): Promise<void> {
  try {
    setRoute(window.location.pathname, elements);
    setTheme(state);
    renderLocation(state, elements);
    bindEvents(state, elements);

    const methodsPayload = await loadMethods();
    state.methods = methodsPayload.methods;
    syncSettings(state, elements);

    await loadPrayerData(state, elements);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось инициализировать приложение";
    setStatus(elements, message);
    setSearchStatus(elements, message);
  }
}

function setTheme(state: AppState): void {
  const resolvedTheme =
    state.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : state.theme;
  document.documentElement.dataset.theme = resolvedTheme;
}

function renderAll(state: AppState, elements: AppElements): void {
  renderLocation(state, elements);
  renderDates(state, elements);
  renderTodayMeta(state, elements);
  renderTodayTimings(state, elements);
  renderMonthlyMeta(state, elements);
  renderMonthlyTable(state, elements);
  renderFavoriteCities(state, elements, async (location) => applyLocation(state, elements, location));
  renderFavoriteToggle(state, elements);
  renderNotifications(state, elements);
  syncSettings(state, elements);
}

function updateCountdown(state: AppState, elements: AppElements): void {
  const { current, next } = getPrayerState(state.today, state.tomorrow);
  state.liveCurrentPrayer = current;
  state.liveNextPrayer = next;

  if (current) {
    elements.currentPrayerName.textContent = current.label;
    elements.currentPrayerTime.textContent = `С ${formatTime(current.time, state.timeFormat)}`;
  } else {
    elements.currentPrayerName.textContent = "Ещё не наступил";
    elements.currentPrayerTime.textContent = "Первым будет Фаджр";
  }

  if (!next || !state.today) {
    elements.nextPrayerName.textContent = "Ожидаем следующее обновление";
    elements.nextPrayerTime.textContent = "Нужны данные на следующий день";
    elements.countdownValue.textContent = "--:--:--";
    elements.countdownMeta.textContent = "Нет данных";
    renderHeroState(state, elements, {
      current,
      next,
      countdown: "--:--:--",
      liveStatus: "Ожидаем данные для следующего намаза.",
      progressPercent: 0,
    });
    return;
  }

  elements.nextPrayerName.textContent = next.label;
  elements.nextPrayerTime.textContent = `${next.date === state.today.requested_date ? "Сегодня" : "Завтра"} в ${formatTime(next.time, state.timeFormat)}`;

  const diffMs = next.datetime.getTime() - Date.now();
  if (diffMs <= 0) {
    elements.countdownValue.textContent = "00:00:00";
    elements.countdownMeta.textContent = "Пересчитываем...";
    renderHeroState(state, elements, {
      current,
      next,
      countdown: "00:00:00",
      liveStatus: "Время намаза наступает прямо сейчас.",
      progressPercent: 100,
    });
    return;
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  const countdown = `${hours}:${minutes}:${seconds}`;
  elements.countdownValue.textContent = countdown;
  elements.countdownMeta.textContent = "До следующего намаза";
  renderHeroState(state, elements, {
    current,
    next,
    countdown,
    liveStatus: buildLiveStatus(current, next, totalSeconds),
    progressPercent: calculateProgressPercent(current, next),
  });
  maybeSendPrayerNotification(state, current);
  renderTodayTimings(state, elements);
}

function startCountdown(state: AppState, elements: AppElements): void {
  if (state.countdownTimer) {
    window.clearInterval(state.countdownTimer);
  }
  updateCountdown(state, elements);
  state.countdownTimer = window.setInterval(() => updateCountdown(state, elements), 1000);
}

async function loadPrayerData(state: AppState, elements: AppElements): Promise<void> {
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

  renderAll(state, elements);
  startCountdown(state, elements);
  setStatus(elements, "Данные обновлены.");
}

async function applyLocation(state: AppState, elements: AppElements, location: LocationResult): Promise<void> {
  state.location = {
    ...location,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };
  saveLocation(state.location);
  renderLocation(state, elements);
  syncSettings(state, elements);
  renderFavoriteToggle(state, elements);
  await loadPrayerData(state, elements);
}

async function handleSearch(state: AppState, elements: AppElements, query: string): Promise<void> {
  const normalized = query.trim();
  if (normalized.length < 2) {
    elements.searchResults.innerHTML = "";
    setSearchStatus(elements, "Введите минимум 2 символа.");
    return;
  }

  setSearchStatus(elements, "Ищем города...");
  const payload = await searchCities(normalized, 5);
  renderSearchResults(payload.results, elements, async (result) => {
    await applyLocation(state, elements, result);
    elements.searchResults.innerHTML = "";
    setSearchStatus(elements, "Город выбран.");
  });
  setSearchStatus(elements, payload.results.length ? "Выберите подходящий вариант." : "Ничего не найдено.");
}

function debounceSearch(state: AppState, elements: AppElements, query: string): void {
  if (state.debounceTimer) {
    window.clearTimeout(state.debounceTimer);
  }
  state.debounceTimer = window.setTimeout(() => {
    void handleSearch(state, elements, query).catch((error: unknown) => {
      setSearchStatus(elements, error instanceof Error ? error.message : "Ошибка поиска");
    });
  }, 350);
}

function detectLocation(state: AppState, elements: AppElements): void {
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
        await applyLocation(state, elements, payload.results[0]);
        setSearchStatus(elements, "Местоположение определено.");
      } catch (error) {
        setSearchStatus(elements, error instanceof Error ? error.message : "Ошибка геолокации");
      }
    },
    () => {
      setSearchStatus(elements, "Доступ к геолокации отклонён. Используйте поиск города.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function shiftMonth(state: AppState, elements: AppElements, offset: number): void {
  state.monthlyDate = new Date(state.monthlyDate.getFullYear(), state.monthlyDate.getMonth() + offset, 1);
  void loadPrayerData(state, elements).catch((error: unknown) => {
    setStatus(elements, error instanceof Error ? error.message : "Ошибка загрузки месяца");
  });
}

function toggleFavorite(state: AppState, elements: AppElements): void {
  const exists = state.favorites.some((item) => item.id === state.location.id);
  if (exists) {
    state.favorites = state.favorites.filter((item) => item.id !== state.location.id);
    setSearchStatus(elements, "Город удалён из избранного.");
  } else {
    state.favorites = [state.location, ...state.favorites.filter((item) => item.id !== state.location.id)].slice(0, 6);
    setSearchStatus(elements, "Город добавлен в избранное.");
  }
  saveFavoriteLocations(state.favorites);
  renderFavoriteCities(state, elements, async (location) => applyLocation(state, elements, location));
  renderFavoriteToggle(state, elements);
}

function buildLiveStatus(current: PrayerMoment | null, next: PrayerMoment | null, totalSeconds: number): string {
  if (!current && next) {
    return `До первого намаза сегодня осталось ${Math.ceil(totalSeconds / 60)} мин.`;
  }
  if (current && next) {
    return `Сейчас идёт ${current.label}. До ${next.label} осталось ${Math.ceil(totalSeconds / 60)} мин.`;
  }
  if (current) {
    return `Сейчас идёт ${current.label}.`;
  }
  return "Ожидаем время следующего намаза.";
}

function calculateProgressPercent(current: PrayerMoment | null, next: PrayerMoment | null): number {
  if (!next) {
    return 0;
  }
  const now = Date.now();
  const currentStart = current ? current.datetime.getTime() : next.datetime.getTime() - 1000 * 60 * 90;
  const total = next.datetime.getTime() - currentStart;
  if (total <= 0) {
    return 100;
  }
  const progress = ((now - currentStart) / total) * 100;
  return Math.min(100, Math.max(0, progress));
}

function maybeSendPrayerNotification(state: AppState, current: PrayerMoment | null): void {
  if (!state.notificationsEnabled || !current || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const notificationKey = `${current.key}-${current.date}`;
  if (!state.lastCurrentPrayerKey) {
    state.lastCurrentPrayerKey = notificationKey;
    return;
  }

  if (state.lastCurrentPrayerKey === notificationKey) {
    return;
  }

  state.lastCurrentPrayerKey = notificationKey;
  const body = `Наступило время намаза ${current.label}.`;
  new Notification("Namaz Time", { body, tag: notificationKey });
}

async function enableNotifications(state: AppState, elements: AppElements): Promise<void> {
  if (!("Notification" in window)) {
    elements.notificationStatus.textContent = "Этот браузер не поддерживает уведомления.";
    return;
  }

  const permission = await Notification.requestPermission();
  state.notificationsEnabled = permission === "granted";
  writeSetting(STORAGE_KEYS.notificationsEnabled, String(state.notificationsEnabled));
  renderNotifications(state, elements);
}

function bindEvents(state: AppState, elements: AppElements): void {
  elements.cityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleSearch(state, elements, elements.cityQuery.value).catch((error: unknown) => {
      setSearchStatus(elements, error instanceof Error ? error.message : "Ошибка поиска");
    });
  });

  elements.cityQuery.addEventListener("input", (event) => {
    debounceSearch(state, elements, (event.target as HTMLInputElement).value);
  });

  elements.locateButton.addEventListener("click", () => detectLocation(state, elements));
  elements.favoriteToggleButton.addEventListener("click", () => toggleFavorite(state, elements));
  elements.retryButton.addEventListener("click", () => {
    void loadPrayerData(state, elements).catch((error: unknown) => {
      setStatus(elements, error instanceof Error ? error.message : "Ошибка загрузки");
    });
  });
  elements.prevMonthButton.addEventListener("click", () => shiftMonth(state, elements, -1));
  elements.nextMonthButton.addEventListener("click", () => shiftMonth(state, elements, 1));

  elements.settingsMethod.addEventListener("change", async (event) => {
    state.method = (event.target as HTMLSelectElement).value;
    writeSetting(STORAGE_KEYS.calculationMethod, state.method);
    await loadPrayerData(state, elements);
  });

  elements.settingsSchool.addEventListener("change", async (event) => {
    state.school = (event.target as HTMLSelectElement).value;
    writeSetting(STORAGE_KEYS.school, state.school);
    await loadPrayerData(state, elements);
  });

  elements.settingsLanguage.addEventListener("change", (event) => {
    state.language = (event.target as HTMLSelectElement).value;
    writeSetting(STORAGE_KEYS.language, state.language);
  });

  elements.settingsTheme.addEventListener("change", (event) => {
    state.theme = (event.target as HTMLSelectElement).value;
    writeSetting(STORAGE_KEYS.theme, state.theme);
    setTheme(state);
    syncSettings(state, elements);
  });

  elements.settingsTimeFormat.addEventListener("change", (event) => {
    state.timeFormat = (event.target as HTMLSelectElement).value;
    writeSetting(STORAGE_KEYS.timeFormat, state.timeFormat);
    renderTodayTimings(state, elements);
    renderMonthlyTable(state, elements);
    updateCountdown(state, elements);
  });

  elements.notificationButton.addEventListener("click", () => {
    void enableNotifications(state, elements);
  });

  elements.navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.getAttribute("href") || "/", elements);
    });
  });

  window.addEventListener("popstate", () => setRoute(window.location.pathname, elements));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.theme === "system") {
      setTheme(state);
    }
  });
}
