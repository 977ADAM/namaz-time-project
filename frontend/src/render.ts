import { PRAYER_LABELS, WEEKDAYS } from "./constants";
import type { AppElements } from "./dom";
import { formatMonthYear, formatTime } from "./formatters";
import type { AppState } from "./state";
import type { LocationResult, PrayerMoment } from "./types";

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
    elements.todayTimes.innerHTML = `<div class="empty-state">Нет данных для отображения.</div>`;
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
  const monthLabel = formatMonthYear(state.monthlyDate);
  elements.monthCurrentLabel.textContent = monthLabel;
  elements.monthlyTitle.textContent = `Расписание на ${monthLabel}`;
  const methodName =
    state.methods.find((item) => String(item.id) === String(state.method))?.name || "Метод не выбран";
  elements.monthlyMeta.textContent = `${state.location.display_name} • ${methodName}`;
}

export function renderMonthlyTable(state: AppState, elements: AppElements): void {
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
      <td>${day.date}</td>
      <td>${WEEKDAYS[day.weekday as keyof typeof WEEKDAYS] || day.weekday}</td>
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
  results: LocationResult[],
  elements: AppElements,
  onSelect: (location: LocationResult) => void | Promise<void>
): void {
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
    elements.favoritesList.innerHTML = `<div class="empty-state compact">Добавьте город в избранное для быстрого переключения.</div>`;
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
  elements.favoriteToggleButton.textContent = isFavorite ? "Убрать из избранного" : "В избранное";
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
    ? `${payload.next.date === state.today?.date?.gregorian ? "Сегодня" : "Завтра"} в ${formatTime(payload.next.time, state.timeFormat)}`
    : "Выберите город";
  elements.heroCountdown.textContent = payload.countdown;
  elements.heroStatus.textContent = payload.liveStatus;
  elements.heroProgressBar.style.width = `${payload.progressPercent}%`;
}

export function renderNotifications(state: AppState, elements: AppElements): void {
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  elements.notificationButton.textContent = state.notificationsEnabled
    ? "Уведомления включены"
    : "Включить уведомления";
  const permissionText =
    permission === "granted"
      ? "Браузерные уведомления разрешены."
      : permission === "denied"
        ? "Браузер заблокировал уведомления."
        : permission === "unsupported"
          ? "Этот браузер не поддерживает уведомления."
          : "Разрешение пока не выдано.";
  elements.notificationStatus.textContent = permissionText;
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
