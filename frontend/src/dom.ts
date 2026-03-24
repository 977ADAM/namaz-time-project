export interface AppElements {
  cityForm: HTMLFormElement;
  cityQuery: HTMLInputElement;
  locateButton: HTMLButtonElement;
  retryButton: HTMLButtonElement;
  searchStatus: HTMLDivElement;
  searchResults: HTMLDivElement;
  favoritesList: HTMLDivElement;
  favoriteToggleButton: HTMLButtonElement;
  quickPresetsList: HTMLDivElement;
  status: HTMLParagraphElement;
  heroPrayerCard: HTMLElement;
  heroPrayerName: HTMLElement;
  heroPrayerTime: HTMLParagraphElement;
  heroCountdown: HTMLElement;
  heroStatus: HTMLParagraphElement;
  heroProgressBar: HTMLDivElement;
  todayTitle: HTMLHeadingElement;
  todayMeta: HTMLParagraphElement;
  todayTimes: HTMLDivElement;
  nextPrayerName: HTMLElement;
  nextPrayerTime: HTMLSpanElement;
  currentPrayerName: HTMLElement;
  currentPrayerTime: HTMLSpanElement;
  countdownValue: HTMLElement;
  countdownMeta: HTMLSpanElement;
  locationName: HTMLElement;
  locationMeta: HTMLSpanElement;
  gregorianDate: HTMLElement;
  hijriDate: HTMLElement;
  monthlyTitle: HTMLHeadingElement;
  monthlyMeta: HTMLParagraphElement;
  monthCurrentLabel: HTMLDivElement;
  monthlyBody: HTMLTableSectionElement;
  prevMonthButton: HTMLButtonElement;
  nextMonthButton: HTMLButtonElement;
  settingsMethod: HTMLSelectElement;
  settingsSchool: HTMLSelectElement;
  settingsLanguage: HTMLSelectElement;
  settingsTheme: HTMLSelectElement;
  settingsTimeFormat: HTMLSelectElement;
  notificationButton: HTMLButtonElement;
  notificationStatus: HTMLParagraphElement;
  notificationLeadMinutes: HTMLSelectElement;
  notificationCurrentCityOnly: HTMLInputElement;
  notificationPrayerCheckboxes: HTMLInputElement[];
  trustMethod: HTMLElement;
  trustTimezone: HTMLElement;
  trustSource: HTMLElement;
  trustUpdated: HTMLElement;
  trustDisclaimer: HTMLParagraphElement;
  navLinks: HTMLAnchorElement[];
  routeSections: HTMLElement[];
}

function queryRequired<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
}

export function getElements(): AppElements {
  return {
    cityForm: queryRequired<HTMLFormElement>("#city-form"),
    cityQuery: queryRequired<HTMLInputElement>("#city-query"),
    locateButton: queryRequired<HTMLButtonElement>("#locate-button"),
    retryButton: queryRequired<HTMLButtonElement>("#retry-button"),
    searchStatus: queryRequired<HTMLDivElement>("#search-status"),
    searchResults: queryRequired<HTMLDivElement>("#search-results"),
    favoritesList: queryRequired<HTMLDivElement>("#favorites-list"),
    favoriteToggleButton: queryRequired<HTMLButtonElement>("#favorite-toggle-button"),
    quickPresetsList: queryRequired<HTMLDivElement>("#quick-presets-list"),
    status: queryRequired<HTMLParagraphElement>("#status"),
    heroPrayerCard: queryRequired<HTMLElement>("#hero-prayer-card"),
    heroPrayerName: queryRequired<HTMLElement>("#hero-prayer-name"),
    heroPrayerTime: queryRequired<HTMLParagraphElement>("#hero-prayer-time"),
    heroCountdown: queryRequired<HTMLElement>("#hero-countdown"),
    heroStatus: queryRequired<HTMLParagraphElement>("#hero-status"),
    heroProgressBar: queryRequired<HTMLDivElement>("#hero-progress-bar"),
    todayTitle: queryRequired<HTMLHeadingElement>("#today-title"),
    todayMeta: queryRequired<HTMLParagraphElement>("#today-meta"),
    todayTimes: queryRequired<HTMLDivElement>("#today-times"),
    nextPrayerName: queryRequired("#next-prayer-name"),
    nextPrayerTime: queryRequired<HTMLSpanElement>("#next-prayer-time"),
    currentPrayerName: queryRequired("#current-prayer-name"),
    currentPrayerTime: queryRequired<HTMLSpanElement>("#current-prayer-time"),
    countdownValue: queryRequired("#countdown-value"),
    countdownMeta: queryRequired<HTMLSpanElement>("#countdown-meta"),
    locationName: queryRequired("#location-name"),
    locationMeta: queryRequired<HTMLSpanElement>("#location-meta"),
    gregorianDate: queryRequired("#gregorian-date"),
    hijriDate: queryRequired("#hijri-date"),
    monthlyTitle: queryRequired<HTMLHeadingElement>("#monthly-title"),
    monthlyMeta: queryRequired<HTMLParagraphElement>("#monthly-meta"),
    monthCurrentLabel: queryRequired<HTMLDivElement>("#month-current-label"),
    monthlyBody: queryRequired<HTMLTableSectionElement>("#monthly-body"),
    prevMonthButton: queryRequired<HTMLButtonElement>("#prev-month-button"),
    nextMonthButton: queryRequired<HTMLButtonElement>("#next-month-button"),
    settingsMethod: queryRequired<HTMLSelectElement>("#settings-method"),
    settingsSchool: queryRequired<HTMLSelectElement>("#settings-school"),
    settingsLanguage: queryRequired<HTMLSelectElement>("#settings-language"),
    settingsTheme: queryRequired<HTMLSelectElement>("#settings-theme"),
    settingsTimeFormat: queryRequired<HTMLSelectElement>("#settings-time-format"),
    notificationButton: queryRequired<HTMLButtonElement>("#notifications-button"),
    notificationStatus: queryRequired<HTMLParagraphElement>("#notifications-status"),
    notificationLeadMinutes: queryRequired<HTMLSelectElement>("#notifications-lead-minutes"),
    notificationCurrentCityOnly: queryRequired<HTMLInputElement>("#notifications-current-city-only"),
    notificationPrayerCheckboxes: Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="notification-prayer"]')
    ),
    trustMethod: queryRequired("#trust-method"),
    trustTimezone: queryRequired("#trust-timezone"),
    trustSource: queryRequired("#trust-source"),
    trustUpdated: queryRequired("#trust-updated"),
    trustDisclaimer: queryRequired<HTMLParagraphElement>("#trust-disclaimer"),
    navLinks: Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-nav]")),
    routeSections: Array.from(document.querySelectorAll<HTMLElement>(".route-section")),
  };
}
