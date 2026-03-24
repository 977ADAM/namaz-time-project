import type { LocationResult } from "./types";

export const STORAGE_KEYS = {
  selectedCity: "selectedCity",
  favoriteCities: "favoriteCities",
  calculationMethod: "calculationMethod",
  language: "language",
  theme: "theme",
  timeFormat: "timeFormat",
  school: "school",
  notificationsEnabled: "notificationsEnabled",
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

export const PRAYER_LABELS = {
  fajr: "Фаджр",
  sunrise: "Восход",
  dhuhr: "Зухр",
  asr: "Аср",
  maghrib: "Магриб",
  isha: "Иша",
} as const;

export const WEEKDAYS = {
  Monday: "Понедельник",
  Tuesday: "Вторник",
  Wednesday: "Среда",
  Thursday: "Четверг",
  Friday: "Пятница",
  Saturday: "Суббота",
  Sunday: "Воскресенье",
} as const;

export const ROUTE_TITLES = {
  "/": "Времена намаза",
  "/monthly": "Месячное расписание намаза",
  "/settings": "Настройки Namaz Time",
  "/about": "О проекте Namaz Time",
} as const;
