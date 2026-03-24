import { PRAYER_LABELS, WEEKDAYS } from "./constants.js";
import { formatMonthYear, formatTime } from "./formatters.js";

export function setStatus(elements, message) {
  elements.status.textContent = message;
}

export function setSearchStatus(elements, message) {
  elements.searchStatus.textContent = message;
}

export function renderLocation(state, elements) {
  elements.locationName.textContent = state.location.display_name;
  const timezone = state.location.timezone || state.today?.meta?.timezone || "timezone не определён";
  elements.locationMeta.textContent = `${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)} • ${timezone}`;
}

export function renderDates(state, elements) {
  elements.gregorianDate.textContent = state.today?.date?.readable || "--";
  elements.hijriDate.textContent = state.today?.date?.hijri?.date || "--";
}

export function renderTodayMeta(state, elements) {
  const methodName = state.today?.meta?.method?.name || "Метод не выбран";
  const timezone = state.today?.meta?.timezone || "Без timezone";
  elements.todayTitle.textContent = state.location.display_name;
  elements.todayMeta.textContent = `${methodName} • ${timezone}`;
}

export function renderTodayTimings(state, elements) {
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
      <strong class="timing-value">${formatTime(rawTime, state.timeFormat)}</strong>
    `;
    elements.todayTimes.appendChild(card);
  });
}

export function renderMonthlyMeta(state, elements) {
  const monthLabel = formatMonthYear(state.monthlyDate);
  elements.monthCurrentLabel.textContent = monthLabel;
  elements.monthlyTitle.textContent = `Расписание на ${monthLabel}`;
  const methodName =
    state.methods.find((item) => String(item.id) === String(state.method))?.name || "Метод не выбран";
  elements.monthlyMeta.textContent = `${state.location.display_name} • ${methodName}`;
}

export function renderMonthlyTable(state, elements) {
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
      <td>${formatTime(day.timings.fajr, state.timeFormat)}</td>
      <td>${formatTime(day.timings.sunrise, state.timeFormat)}</td>
      <td>${formatTime(day.timings.dhuhr, state.timeFormat)}</td>
      <td>${formatTime(day.timings.asr, state.timeFormat)}</td>
      <td>${formatTime(day.timings.maghrib, state.timeFormat)}</td>
      <td>${formatTime(day.timings.isha, state.timeFormat)}</td>
    `;
    elements.monthlyBody.appendChild(row);
  });
}

export function renderSearchResults(results, elements, onSelect) {
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
    button.addEventListener("click", () => onSelect(result));
    elements.searchResults.appendChild(button);
  });
}

export function syncSettings(state, elements) {
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
