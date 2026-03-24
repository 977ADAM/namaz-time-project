import { PRAYER_LABELS } from "./constants";
import type { AppElements } from "./dom";
import { formatDateTime, formatMonthYear, formatTime } from "./formatters";
import { getLocaleCode, t } from "./locales";
import type { AppState } from "./state";
import type { CityComparison, LocationResult, NotifiablePrayerKey, PrayerMoment, QuickPreset } from "./types";

function formatWeekdayLabel(dayIsoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(`${dayIsoDate}T00:00:00Z`));
}

export function setStatus(elements: AppElements, message: string): void {
  elements.status.textContent = message;
}

export function setSearchStatus(elements: AppElements, message: string): void {
  elements.searchStatus.textContent = message;
}

export function renderLocation(state: AppState, elements: AppElements): void {
  elements.locationName.textContent = state.location.display_name;
  const timezone = state.location.timezone || state.today?.location?.timezone || "timezone не определён";
  elements.locationMeta.textContent = `${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)} • ${timezone}`;
}

export function renderDates(state: AppState, elements: AppElements): void {
  elements.gregorianDate.textContent = state.today?.date?.gregorian || "--";
  elements.hijriDate.textContent = state.today?.date?.hijri || "--";
}

export function renderTodayMeta(state: AppState, elements: AppElements): void {
  const methodName = state.today?.method?.name || "Метод не выбран";
  const timezone = state.today?.location?.timezone || "Без timezone";
  elements.todayTitle.textContent = state.location.display_name;
  elements.todayMeta.textContent = `${methodName} • ${timezone}`;
}

export function renderTodayTimings(state: AppState, elements: AppElements): void {
  elements.todayTimes.innerHTML = "";
  if (!state.today?.times) {
    elements.todayTimes.innerHTML = `<div class="empty-state">${t(state.language, "status.noData")}</div>`;
    return;
  }

  const currentKey = state.liveCurrentPrayer?.key;
  const nextKey = state.liveNextPrayer?.key;

  Object.entries(state.today.times).forEach(([key, rawTime]) => {
    const card = document.createElement("article");
    card.className = "timing-card";
    if (key === currentKey) {
      card.classList.add("timing-card-current");
    } else if (key === nextKey) {
      card.classList.add("timing-card-next");
    }
    card.innerHTML = `
      <span class="timing-name">${PRAYER_LABELS[key as keyof typeof PRAYER_LABELS] || key}</span>
      <strong class="timing-value">${formatTime(rawTime, state.timeFormat)}</strong>
    `;
    elements.todayTimes.appendChild(card);
  });
}

export function renderMonthlyMeta(state: AppState, elements: AppElements): void {
  const monthLabel = formatMonthYear(state.monthlyDate, getLocaleCode(state.language));
  elements.monthCurrentLabel.textContent = monthLabel;
  elements.monthlyTitle.textContent = `${t(state.language, "monthly.title")} ${monthLabel}`;
  const methodName =
    state.methods.find((item) => String(item.id) === String(state.method))?.name || "Метод не выбран";
  elements.monthlyMeta.textContent = `${state.location.display_name} • ${methodName}`;
}

function getPresetLabel(state: AppState, preset: QuickPreset): string {
  return t(state.language, `preset.${preset.id}`);
}

export function renderMonthlyTable(state: AppState, elements: AppElements): void {
  if (!state.monthly?.days?.length) {
    elements.monthlyBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">${t(state.language, "status.noMonthData")}</td>
      </tr>
    `;
    return;
  }

  elements.monthlyBody.innerHTML = "";
  state.monthly.days.forEach((day) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${day.date}</td>
      <td>${formatWeekdayLabel(day.date, getLocaleCode(state.language))}</td>
      <td>${day.hijri || "—"}</td>
      <td>${formatTime(day.times.fajr, state.timeFormat)}</td>
      <td>${formatTime(day.times.sunrise, state.timeFormat)}</td>
      <td>${formatTime(day.times.dhuhr, state.timeFormat)}</td>
      <td>${formatTime(day.times.asr, state.timeFormat)}</td>
      <td>${formatTime(day.times.maghrib, state.timeFormat)}</td>
      <td>${formatTime(day.times.isha, state.timeFormat)}</td>
    `;
    elements.monthlyBody.appendChild(row);
  });
}

export function renderSearchResults(
  state: AppState,
  results: LocationResult[],
  elements: AppElements,
  onSelect: (location: LocationResult) => void | Promise<void>
): void {
  elements.searchResults.innerHTML = "";
  if (!results.length) {
    elements.searchResults.innerHTML = `<div class="empty-state compact">${t(state.language, "search.none")}</div>`;
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
    button.addEventListener("click", () => {
      void onSelect(result);
    });
    elements.searchResults.appendChild(button);
  });
}

export function renderFavoriteCities(
  state: AppState,
  elements: AppElements,
  onSelect: (location: LocationResult) => void | Promise<void>
): void {
  elements.favoritesList.innerHTML = "";
  if (!state.favorites.length) {
    elements.favoritesList.innerHTML = `<div class="empty-state compact">${t(state.language, "favorites.empty")}</div>`;
    return;
  }

  state.favorites.forEach((location) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "favorite-chip";
    if (location.id === state.location.id) {
      button.classList.add("favorite-chip-active");
    }
    button.textContent = location.city;
    button.addEventListener("click", () => {
      void onSelect(location);
    });
    elements.favoritesList.appendChild(button);
  });
}

export function renderFavoriteToggle(state: AppState, elements: AppElements): void {
  const isFavorite = state.favorites.some((item) => item.id === state.location.id);
  elements.favoriteToggleButton.textContent = isFavorite ? t(state.language, "favorites.remove") : t(state.language, "favorites.toggle");
}

export function renderQuickPresets(
  state: AppState,
  elements: AppElements,
  onSelect: (preset: QuickPreset) => void | Promise<void>
): void {
  elements.quickPresetsList.innerHTML = "";
  state.quickPresets.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-card";
    if (preset.location?.id === state.location.id) {
      button.classList.add("preset-card-active");
    }
    if (!preset.location) {
      button.classList.add("preset-card-empty");
    }
    button.innerHTML = `
      <span class="preset-label">${getPresetLabel(state, preset)}</span>
      <strong class="preset-title">${preset.location?.city || t(state.language, "preset.saveCurrent")}</strong>
      <small class="preset-meta">${preset.location?.country || t(state.language, "preset.assignCurrent")}</small>
    `;
    button.addEventListener("click", () => {
      void onSelect(preset);
    });
    elements.quickPresetsList.appendChild(button);
  });
}

export function renderCityComparisons(
  state: AppState,
  comparisons: CityComparison[],
  elements: AppElements,
  onSelect: (presetId: string) => void | Promise<void>
): void {
  elements.compareList.innerHTML = "";
  if (!comparisons.length) {
    elements.compareList.innerHTML = `<div class="empty-state compact">${t(state.language, "compare.empty")}</div>`;
    return;
  }

  comparisons.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "compare-card";
    if (item.isActive) {
      button.classList.add("compare-card-active");
    }
    button.innerHTML = `
      <span class="preset-label">${item.presetLabel}</span>
      <strong class="preset-title">${item.city}</strong>
      <small class="preset-meta">${item.timezone}</small>
      <div class="compare-inline">
        <span>${item.nextPrayerLabel}</span>
        <strong>${item.nextPrayerTime}</strong>
      </div>
      <small class="preset-meta">${item.countdownLabel}</small>
    `;
    button.addEventListener("click", () => {
      void onSelect(item.presetId);
    });
    elements.compareList.appendChild(button);
  });
}

export function renderHeroState(
  state: AppState,
  elements: AppElements,
  payload: {
    current: PrayerMoment | null;
    next: PrayerMoment | null;
    countdown: string;
    liveStatus: string;
    progressPercent: number;
  }
): void {
  elements.heroPrayerName.textContent = payload.next?.label || "Нет данных";
  elements.heroPrayerTime.textContent = payload.next
    ? `${payload.next.date === state.today?.date?.gregorian ? t(state.language, "countdown.today") : t(state.language, "countdown.tomorrow")} ${formatTime(payload.next.time, state.timeFormat)}`
    : t(state.language, "status.chooseCity");
  elements.heroCountdown.textContent = payload.countdown;
  elements.heroStatus.textContent = payload.liveStatus;
  elements.heroProgressBar.style.width = `${payload.progressPercent}%`;
}

export function renderNotifications(state: AppState, elements: AppElements): void {
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  elements.notificationButton.textContent = state.notificationsEnabled
    ? t(state.language, "notification.enabled")
    : t(state.language, "notification.enable");
  const permissionText =
    permission === "granted"
      ? t(state.language, "notification.permission.granted")
      : permission === "denied"
        ? t(state.language, "notification.permission.denied")
        : permission === "unsupported"
          ? t(state.language, "notification.permission.unsupported")
          : t(state.language, "notification.permission.default");
  const selectedPrayers = state.notificationPrayerKeys.map((key) => PRAYER_LABELS[key]).join(", ");
  const leadText =
    state.notificationLeadMinutes > 0 ? `${state.notificationLeadMinutes} min.` : t(state.language, "notification.lead.instant");
  elements.notificationStatus.textContent = `${permissionText} Сценарий: ${selectedPrayers}, ${leadText}.`;
  elements.notificationLeadMinutes.value = String(state.notificationLeadMinutes);
  elements.notificationCurrentCityOnly.checked = state.notificationCurrentCityOnly;
  elements.notificationPrayerCheckboxes.forEach((checkbox) => {
    checkbox.checked = state.notificationPrayerKeys.includes(checkbox.value as NotifiablePrayerKey);
  });
}

export function renderTrustLayer(state: AppState, elements: AppElements): void {
  const methodName = state.today?.method?.name || "Метод ещё не выбран";
  const timezone = state.today?.location?.timezone || state.location.timezone || "timezone не определён";
  const updatedAt = state.lastUpdatedAt
    ? formatDateTime(
        state.lastUpdatedAt,
        getLocaleCode(state.language),
        state.today?.location?.timezone || state.location.timezone || undefined
      )
    : "ещё не обновлялось";

  elements.trustMethod.textContent = methodName;
  elements.trustTimezone.textContent = timezone;
  elements.trustSource.textContent = "Aladhan API";
  elements.trustUpdated.textContent = updatedAt;
  elements.trustDisclaimer.textContent =
    t(state.language, "trust.disclaimer");
}

export function renderInstallState(state: AppState, elements: AppElements): void {
  elements.installAppButton.disabled = !state.pwaInstallAvailable;
  elements.installAppButton.textContent = t(state.language, "settings.installButton");
  elements.installAppStatus.textContent = state.pwaInstallAvailable
    ? t(state.language, "settings.installHint")
    : t(state.language, "settings.installUnavailable");
}

export function syncSettings(state: AppState, elements: AppElements): void {
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
