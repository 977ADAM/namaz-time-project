import type { AppLanguage, LocationResult, NotifiablePrayerKey, QuickPreset } from "./types";

export const STORAGE_KEYS = {
  selectedCity: "selectedCity",
  favoriteCities: "favoriteCities",
  calculationMethod: "calculationMethod",
  language: "language",
  theme: "theme",
  timeFormat: "timeFormat",
  school: "school",
  notificationsEnabled: "notificationsEnabled",
  notificationLeadMinutes: "notificationLeadMinutes",
  notificationPrayerKeys: "notificationPrayerKeys",
  notificationCurrentCityOnly: "notificationCurrentCityOnly",
  quickPresetLocations: "quickPresetLocations",
  pwaInstallDismissed: "pwaInstallDismissed",
} as const;

export const DEFAULT_LOCATION: LocationResult = {
  id: "default-moscow",
  city: "Moscow",
  country: "Russia",
  region: "Moscow",
  display_name: "Moscow, Russia",
  latitude: 55.7558,
  longitude: 37.6173,
  timezone: "Europe/Moscow",
};

export const QUICK_PRESET_BASE_LOCATIONS: Record<string, LocationResult> = {
  makkah: {
    id: "preset-makkah",
    city: "Makkah",
    country: "Saudi Arabia",
    region: "Makkah Province",
    display_name: "Makkah, Saudi Arabia",
    latitude: 21.3891,
    longitude: 39.8579,
    timezone: "Asia/Riyadh",
  },
  tashkent: {
    id: "preset-tashkent",
    city: "Tashkent",
    country: "Uzbekistan",
    region: "Tashkent",
    display_name: "Tashkent, Uzbekistan",
    latitude: 41.2995,
    longitude: 69.2401,
    timezone: "Asia/Tashkent",
  },
};

export const QUICK_PRESET_DEFAULTS: QuickPreset[] = [
  { id: "home", label: "Дом", location: null, assignable: true, notificationProfile: null },
  { id: "work", label: "Работа", location: null, assignable: true, notificationProfile: null },
  { id: "travel", label: "Путешествие", location: null, assignable: true, notificationProfile: null },
];

export const PRAYER_LABELS = {
  fajr: "Фаджр",
  sunrise: "Восход",
  dhuhr: "Зухр",
  asr: "Аср",
  maghrib: "Магриб",
  isha: "Иша",
} as const;

export const NOTIFIABLE_PRAYER_KEYS: NotifiablePrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export const WEEKDAYS = {
  Monday: "Понедельник",
  Tuesday: "Вторник",
  Wednesday: "Среда",
  Thursday: "Четверг",
  Friday: "Пятница",
  Saturday: "Суббота",
  Sunday: "Воскресенье",
} as const;

export const LANGUAGE_LOCALES: Record<AppLanguage, string> = {
  ru: "ru-RU",
  en: "en-US",
  uz: "uz-UZ",
  ar: "ar-SA",
};
