import { STORAGE_KEYS } from "./constants";
import { loadFavoriteLocations, loadStoredLocation, readSetting } from "./storage";
import type { CalculationMethod, LocationResult, PrayerCalendarResponse, PrayerMoment, PrayerTimesResponse } from "./types";

export interface AppState {
  methods: CalculationMethod[];
  location: ReturnType<typeof loadStoredLocation>;
  favorites: LocationResult[];
  method: string;
  school: string;
  language: string;
  theme: string;
  timeFormat: string;
  notificationsEnabled: boolean;
  today: PrayerTimesResponse | null;
  tomorrow: PrayerTimesResponse | null;
  monthly: PrayerCalendarResponse | null;
  liveCurrentPrayer: PrayerMoment | null;
  liveNextPrayer: PrayerMoment | null;
  monthlyDate: Date;
  debounceTimer: number | null;
  countdownTimer: number | null;
  lastCurrentPrayerKey: string | null;
  lastVisualPrayerKey: string | null;
}

export function createAppState(): AppState {
  return {
    methods: [],
    location: loadStoredLocation(),
    favorites: loadFavoriteLocations(),
    method: readSetting(STORAGE_KEYS.calculationMethod, "2"),
    school: readSetting(STORAGE_KEYS.school, "0"),
    language: readSetting(STORAGE_KEYS.language, "ru"),
    theme: readSetting(STORAGE_KEYS.theme, "system"),
    timeFormat: readSetting(STORAGE_KEYS.timeFormat, "24h"),
    notificationsEnabled: readSetting(STORAGE_KEYS.notificationsEnabled, "false") === "true",
    today: null,
    tomorrow: null,
    monthly: null,
    liveCurrentPrayer: null,
    liveNextPrayer: null,
    monthlyDate: new Date(),
    debounceTimer: null,
    countdownTimer: null,
    lastCurrentPrayerKey: null,
    lastVisualPrayerKey: null,
  };
}
