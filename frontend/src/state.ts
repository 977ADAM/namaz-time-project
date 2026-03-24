import { STORAGE_KEYS } from "./constants";
import { loadStoredLocation, readSetting } from "./storage";
import type { CalculationMethod, PrayerCalendarResponse, PrayerTimesResponse } from "./types";

export interface AppState {
  methods: CalculationMethod[];
  location: ReturnType<typeof loadStoredLocation>;
  method: string;
  school: string;
  language: string;
  theme: string;
  timeFormat: string;
  today: PrayerTimesResponse | null;
  tomorrow: PrayerTimesResponse | null;
  monthly: PrayerCalendarResponse | null;
  monthlyDate: Date;
  debounceTimer: number | null;
  countdownTimer: number | null;
}

export function createAppState(): AppState {
  return {
    methods: [],
    location: loadStoredLocation(),
    method: readSetting(STORAGE_KEYS.calculationMethod, "2"),
    school: readSetting(STORAGE_KEYS.school, "0"),
    language: readSetting(STORAGE_KEYS.language, "ru"),
    theme: readSetting(STORAGE_KEYS.theme, "system"),
    timeFormat: readSetting(STORAGE_KEYS.timeFormat, "24h"),
    today: null,
    tomorrow: null,
    monthly: null,
    monthlyDate: new Date(),
    debounceTimer: null,
    countdownTimer: null,
  };
}
