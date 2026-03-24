import { loadMethods, loadPrayerBundle, loadPrayerTimesForLocation, reverseLocation, searchCities } from "./api";
import { STORAGE_KEYS } from "./constants";
import type { AppElements } from "./dom";
import { getElements } from "./dom";
import { formatTime, getIsoDateInTimezone, parsePrayerTime, shiftIsoDate } from "./formatters";
import { applyDocumentTranslations, t } from "./locales";
import { getPrayerState } from "./prayer";
import {
  renderCityComparisons,
  renderFavoriteCities,
  renderFavoriteToggle,
  renderHeroState,
  renderInstallState,
  renderDates,
  renderLocation,
  renderMonthlyMeta,
  renderMonthlyTable,
  renderNotifications,
  renderQuickPresets,
  renderSearchResults,
  renderTodayMeta,
  renderTodayTimings,
  renderTrustLayer,
  setSearchStatus,
  setStatus,
  syncSettings,
} from "./render";
import { navigate, setRoute } from "./router";
import { createAppState, type AppState, type BeforeInstallPromptEvent } from "./state";
import { saveFavoriteLocations, saveLocation, saveQuickPresets, writeSetting } from "./storage";
import type {
  CityComparison,
  LocationResult,
  NotificationProfile,
  NotifiablePrayerKey,
  PrayerMoment,
  QuickPreset,
} from "./types";

export function initApp(): void {
  const state = createAppState();
  const elements = getElements();

  void bootstrap(state, elements);
}

async function bootstrap(state: AppState, elements: AppElements): Promise<void> {
  try {
    applyLanguage(state, elements);
    setRoute(window.location.pathname, elements, state.language);
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

function applyLanguage(state: AppState, elements: AppElements): void {
  applyDocumentTranslations(state.language);
  setRoute(window.location.pathname, elements, state.language);
}

function renderAll(state: AppState, elements: AppElements): void {
  applyLanguage(state, elements);
  renderLocation(state, elements);
  renderDates(state, elements);
  renderTodayMeta(state, elements);
  renderTodayTimings(state, elements);
  renderMonthlyMeta(state, elements);
  renderMonthlyTable(state, elements);
  renderFavoriteCities(state, elements, async (location) => applyLocation(state, elements, location));
  renderQuickPresets(state, elements, async (preset) => handleQuickPreset(state, elements, preset));
  renderCityComparisons(state, state.cityComparisons, elements, async (presetId) => selectPresetById(state, elements, presetId));
  renderFavoriteToggle(state, elements);
  renderNotifications(state, elements);
  renderInstallState(state, elements);
  renderTrustLayer(state, elements);
  syncSettings(state, elements);
}

function getCurrentNotificationProfile(state: AppState): NotificationProfile {
  return {
    enabled: state.notificationsEnabled,
    leadMinutes: state.notificationLeadMinutes,
    prayerKeys: [...state.notificationPrayerKeys],
    currentCityOnly: state.notificationCurrentCityOnly,
  };
}

function persistNotificationSettings(state: AppState): void {
  writeSetting(STORAGE_KEYS.notificationsEnabled, String(state.notificationsEnabled));
  writeSetting(STORAGE_KEYS.notificationLeadMinutes, String(state.notificationLeadMinutes));
  writeSetting(STORAGE_KEYS.notificationPrayerKeys, state.notificationPrayerKeys.join(","));
  writeSetting(STORAGE_KEYS.notificationCurrentCityOnly, String(state.notificationCurrentCityOnly));
}

function syncPresetProfileFromState(state: AppState): void {
  const activePreset = state.quickPresets.find((preset) => preset.id === state.activePresetId);
  if (!activePreset) {
    return;
  }

  state.quickPresets = state.quickPresets.map((preset) =>
    preset.id === activePreset.id ? { ...preset, notificationProfile: getCurrentNotificationProfile(state) } : preset
  );
  saveQuickPresets(state.quickPresets);
}

function updateActivePresetId(state: AppState): void {
  const match = state.quickPresets.find((preset) => preset.location?.id === state.location.id);
  state.activePresetId = match?.id ?? null;
}

async function selectPresetById(state: AppState, elements: AppElements, presetId: string): Promise<void> {
  const preset = state.quickPresets.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }
  await handleQuickPreset(state, elements, preset);
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
    document.documentElement.dataset.prePrayer = "idle";
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
  elements.nextPrayerTime.textContent = `${next.date === state.today.date.gregorian ? "Сегодня" : "Завтра"} в ${formatTime(next.time, state.timeFormat)}`;

  const diffMs = next.datetime.getTime() - Date.now();
  if (diffMs <= 0) {
    applyAtmosphere(current, next, 0);
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
  applyAtmosphere(current, next, totalSeconds);
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
  maybeAnimatePrayerTransition(state, elements, current, next);
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
  const activeTimezone = state.location.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayValue = getIsoDateInTimezone(activeTimezone);
  const tomorrowValue = shiftIsoDate(todayValue, 1);

  setStatus(elements, t(state.language, "status.loadingPrayerTimes"));
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
  state.location.timezone = todayPayload.location?.timezone || state.location.timezone;
  state.lastUpdatedAt = new Date();
  updateActivePresetId(state);
  await refreshCityComparisons(state);
  saveLocation(state.location);

  renderAll(state, elements);
  startCountdown(state, elements);
  setStatus(elements, t(state.language, "status.dataUpdated"));
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

async function handleQuickPreset(state: AppState, elements: AppElements, preset: QuickPreset): Promise<void> {
  if (preset.location) {
    if (preset.notificationProfile) {
      state.notificationsEnabled = preset.notificationProfile.enabled;
      state.notificationLeadMinutes = preset.notificationProfile.leadMinutes;
      state.notificationPrayerKeys = [...preset.notificationProfile.prayerKeys];
      state.notificationCurrentCityOnly = preset.notificationProfile.currentCityOnly;
      persistNotificationSettings(state);
    }
    await applyLocation(state, elements, preset.location);
    setSearchStatus(elements, `${t(state.language, `preset.${preset.id}`)}.`);
    return;
  }

  if (!preset.assignable) {
    return;
  }

  state.quickPresets = state.quickPresets.map((item) =>
    item.id === preset.id
      ? { ...item, location: { ...state.location }, notificationProfile: getCurrentNotificationProfile(state) }
      : item
  );
  saveQuickPresets(state.quickPresets);
  updateActivePresetId(state);
  await refreshCityComparisons(state);
  renderAll(state, elements);
  setSearchStatus(elements, `${t(state.language, `preset.${preset.id}`)}.`);
}

async function refreshCityComparisons(state: AppState): Promise<void> {
  const presets = state.quickPresets.filter((preset) => preset.location);
  if (!presets.length) {
    state.cityComparisons = [];
    return;
  }

  const comparisons = await Promise.allSettled(
    presets.map(async (preset) => {
      const location = preset.location!;
      const payload =
        location.id === state.location.id && state.today
          ? state.today
          : await loadPrayerTimesForLocation({
              latitude: location.latitude,
              longitude: location.longitude,
              method: state.method,
              school: state.school,
              date: getIsoDateInTimezone(location.timezone || state.location.timezone || "UTC"),
            });
      return buildCityComparison(state, preset, payload);
    })
  );

  state.cityComparisons = comparisons
    .filter((result): result is PromiseFulfilledResult<CityComparison> => result.status === "fulfilled")
    .map((result) => result.value);
}

function buildCityComparison(state: AppState, preset: QuickPreset, payload: Awaited<ReturnType<typeof loadPrayerTimesForLocation>>): CityComparison {
  const timezone = payload.location.timezone;
  const nextPrayer = payload.next_prayer;
  const nextDate = payload.next_prayer_date || payload.date.gregorian;
  const nextDateTime =
    nextPrayer && nextDate ? parsePrayerTime(nextDate, nextPrayer.time, timezone) : null;
  const diffSeconds = nextDateTime ? Math.max(0, Math.floor((nextDateTime.getTime() - Date.now()) / 1000)) : 0;
  const hours = String(Math.floor(diffSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, "0");

  return {
    presetId: preset.id,
    presetLabel: t(state.language, `preset.${preset.id}`),
    city: payload.location.city,
    timezone,
    nextPrayerLabel: nextPrayer?.label || t(state.language, "status.noData"),
    nextPrayerTime: nextPrayer ? formatTime(nextPrayer.time, state.timeFormat) : "--",
    countdownLabel: diffSeconds ? `${hours}:${minutes}` : t(state.language, "notification.lead.instant"),
    isActive: preset.location?.id === state.location.id,
  };
}

async function handleSearch(state: AppState, elements: AppElements, query: string): Promise<void> {
  const normalized = query.trim();
  if (normalized.length < 2) {
    elements.searchResults.innerHTML = "";
    setSearchStatus(elements, t(state.language, "search.minChars"));
    return;
  }

  setSearchStatus(elements, t(state.language, "search.loading"));
  const payload = await searchCities(normalized, 5);
  renderSearchResults(state, payload.results, elements, async (result) => {
    await applyLocation(state, elements, result);
    elements.searchResults.innerHTML = "";
    setSearchStatus(elements, t(state.language, "search.selected"));
  });
  setSearchStatus(elements, payload.results.length ? t(state.language, "search.chooseResult") : t(state.language, "search.none"));
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
    setSearchStatus(elements, t(state.language, "search.geoUnavailable"));
    return;
  }

  setSearchStatus(elements, t(state.language, "search.geolocating"));
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const payload = await reverseLocation(coords.latitude, coords.longitude);
        if (!payload.results.length) {
          throw new Error(t(state.language, "search.geoNotFound"));
        }
        await applyLocation(state, elements, payload.results[0]);
        setSearchStatus(elements, t(state.language, "search.geoDetected"));
      } catch (error) {
        setSearchStatus(elements, error instanceof Error ? error.message : "Ошибка геолокации");
      }
    },
    () => {
      setSearchStatus(elements, t(state.language, "search.geoDenied"));
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function shiftMonth(state: AppState, elements: AppElements, offset: number): void {
  state.monthlyDate = new Date(state.monthlyDate.getFullYear(), state.monthlyDate.getMonth() + offset, 1);
  void loadPrayerData(state, elements).catch((error: unknown) => {
    setStatus(elements, error instanceof Error ? error.message : t(state.language, "status.reloadingMonth"));
  });
}

function toggleFavorite(state: AppState, elements: AppElements): void {
  const exists = state.favorites.some((item) => item.id === state.location.id);
  if (exists) {
    state.favorites = state.favorites.filter((item) => item.id !== state.location.id);
    setSearchStatus(elements, t(state.language, "favorites.remove"));
  } else {
    state.favorites = [state.location, ...state.favorites.filter((item) => item.id !== state.location.id)].slice(0, 6);
    setSearchStatus(elements, t(state.language, "favorites.toggle"));
  }
  saveFavoriteLocations(state.favorites);
  renderFavoriteCities(state, elements, async (location) => applyLocation(state, elements, location));
  renderFavoriteToggle(state, elements);
}

function getSelectedNotificationPrayers(elements: AppElements): NotifiablePrayerKey[] {
  const values = elements.notificationPrayerCheckboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value as NotifiablePrayerKey);
  return values.length ? values : ["fajr", "maghrib"];
}

function buildLiveStatus(current: PrayerMoment | null, next: PrayerMoment | null, totalSeconds: number): string {
  if (totalSeconds <= 60 && next) {
    return `Ещё немного, и начнётся ${next.label}. Подготовьтесь к намазу.`;
  }
  if (totalSeconds <= 10 * 60 && next) {
    return `До ${next.label} осталось ${Math.ceil(totalSeconds / 60)} мин. Спокойный режим подготовки уже включён.`;
  }
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
  if (
    !state.notificationsEnabled ||
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    !state.today
  ) {
    return;
  }

  const locationKey = state.notificationCurrentCityOnly ? state.location.id : "global";

  if (current && state.notificationPrayerKeys.includes(current.key as NotifiablePrayerKey)) {
    const notificationKey = `${locationKey}:start:${current.key}:${current.date}`;
    if (!state.lastCurrentPrayerKey) {
      state.lastCurrentPrayerKey = notificationKey;
    }

    if (!state.sentNotificationKeys.has(notificationKey)) {
      state.sentNotificationKeys.add(notificationKey);
      state.lastCurrentPrayerKey = notificationKey;
      void dispatchNotification({
        title: "Namaz Time",
        body: `Наступило время намаза ${current.label} в ${state.location.city}.`,
        tag: notificationKey,
      });
    }
  }

  const next = state.liveNextPrayer;
  if (!next || !state.notificationPrayerKeys.includes(next.key as NotifiablePrayerKey)) {
    return;
  }

  const diffSeconds = Math.floor((next.datetime.getTime() - Date.now()) / 1000);
  const leadSeconds = state.notificationLeadMinutes * 60;
  if (diffSeconds <= 0 || leadSeconds <= 0 || diffSeconds > leadSeconds) {
    return;
  }

  const reminderKey = `${locationKey}:lead:${next.key}:${next.date}:${state.notificationLeadMinutes}`;
  if (state.sentNotificationKeys.has(reminderKey)) {
    return;
  }

  state.sentNotificationKeys.add(reminderKey);
  void dispatchNotification({
    title: "Namaz Time",
    body: `До ${next.label} в ${state.location.city} осталось ${state.notificationLeadMinutes} мин.`,
    tag: reminderKey,
  });
}

async function dispatchNotification(
  payload: {
    title: string;
    body: string;
    tag: string;
  }
): Promise<void> {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        icon: "/icons/icon-192.svg",
        badge: "/icons/badge-72.svg",
        data: { url: window.location.pathname },
      });
      return;
    }
  }

  new Notification(payload.title, { body: payload.body, tag: payload.tag });
}

function applyAtmosphere(current: PrayerMoment | null, next: PrayerMoment | null, totalSeconds: number): void {
  const phase = resolvePhase(current, next);
  document.documentElement.dataset.phase = phase;
  const prePrayerState = totalSeconds <= 10 * 60 ? (totalSeconds <= 60 ? "imminent" : "active") : "idle";
  document.documentElement.dataset.prePrayer = prePrayerState;
}

function resolvePhase(current: PrayerMoment | null, next: PrayerMoment | null): string {
  const anchor = current?.key ?? next?.key;
  switch (anchor) {
    case "fajr":
      return "dawn";
    case "dhuhr":
    case "asr":
      return "day";
    case "maghrib":
      return "sunset";
    case "isha":
      return "night";
    default:
      return "dawn";
  }
}

function maybeAnimatePrayerTransition(
  state: AppState,
  elements: AppElements,
  current: PrayerMoment | null,
  next: PrayerMoment | null
): void {
  const visualKey = `${current?.key ?? "none"}-${next?.key ?? "none"}-${next?.date ?? "none"}`;
  if (!state.lastVisualPrayerKey) {
    state.lastVisualPrayerKey = visualKey;
    return;
  }
  if (state.lastVisualPrayerKey === visualKey) {
    return;
  }

  state.lastVisualPrayerKey = visualKey;
  elements.heroPrayerCard.classList.remove("hero-prayer-card-burst");
  window.requestAnimationFrame(() => {
    elements.heroPrayerCard.classList.add("hero-prayer-card-burst");
  });
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
  syncPresetProfileFromState(state);
}

async function installPwa(state: AppState, elements: AppElements): Promise<void> {
  if (!state.deferredInstallPrompt) {
    renderInstallState(state, elements);
    return;
  }

  await state.deferredInstallPrompt.prompt();
  const choice = await state.deferredInstallPrompt.userChoice;
  state.pwaInstallAvailable = false;
  state.deferredInstallPrompt = null;
  writeSetting(STORAGE_KEYS.pwaInstallDismissed, String(choice.outcome === "dismissed"));
  renderInstallState(state, elements);
}

function bindEvents(state: AppState, elements: AppElements): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event as BeforeInstallPromptEvent;
    state.pwaInstallAvailable = true;
    renderInstallState(state, elements);
  });

  window.addEventListener("appinstalled", () => {
    state.pwaInstallAvailable = false;
    state.deferredInstallPrompt = null;
    renderInstallState(state, elements);
  });

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
  elements.mobileChangeCityButton.addEventListener("click", () => {
    document.querySelector(".search-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
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
    state.language = (event.target as HTMLSelectElement).value as AppState["language"];
    writeSetting(STORAGE_KEYS.language, state.language);
    renderAll(state, elements);
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

  elements.notificationLeadMinutes.addEventListener("change", (event) => {
    state.notificationLeadMinutes = Number((event.target as HTMLSelectElement).value);
    writeSetting(STORAGE_KEYS.notificationLeadMinutes, String(state.notificationLeadMinutes));
    renderNotifications(state, elements);
    syncPresetProfileFromState(state);
  });

  elements.notificationCurrentCityOnly.addEventListener("change", (event) => {
    state.notificationCurrentCityOnly = (event.target as HTMLInputElement).checked;
    writeSetting(STORAGE_KEYS.notificationCurrentCityOnly, String(state.notificationCurrentCityOnly));
    renderNotifications(state, elements);
    syncPresetProfileFromState(state);
  });

  elements.notificationPrayerCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      state.notificationPrayerKeys = getSelectedNotificationPrayers(elements);
      writeSetting(STORAGE_KEYS.notificationPrayerKeys, state.notificationPrayerKeys.join(","));
      renderNotifications(state, elements);
      syncPresetProfileFromState(state);
    });
  });

  elements.installAppButton.addEventListener("click", () => {
    void installPwa(state, elements);
  });

  elements.navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.getAttribute("href") || "/", elements, state.language);
    });
  });

  window.addEventListener("popstate", () => setRoute(window.location.pathname, elements, state.language));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.theme === "system") {
      setTheme(state);
    }
  });

  elements.heroPrayerCard.addEventListener("animationend", () => {
    elements.heroPrayerCard.classList.remove("hero-prayer-card-burst");
  });
}
