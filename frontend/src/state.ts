import { STORAGE_KEYS } from "./constants";
import { loadFavoriteLocations, loadQuickPresets, loadStoredLocation, readSetting } from "./storage";
import type {
  AppLanguage,
  CalculationMethod,
  CityComparison,
  LocationResult,
  NotifiablePrayerKey,
  PrayerCalendarResponse,
  PrayerMoment,
  PrayerTimesResponse,
  QuickPreset,
} from "./types";

export interface AppState {
  methods: CalculationMethod[];
  location: ReturnType<typeof loadStoredLocation>;
  favorites: LocationResult[];
  quickPresets: QuickPreset[];
  method: string;
  school: string;
  language: AppLanguage;
  theme: string;
  timeFormat: string;
  notificationsEnabled: boolean;
  notificationLeadMinutes: number;
  notificationPrayerKeys: NotifiablePrayerKey[];
  notificationCurrentCityOnly: boolean;
  today: PrayerTimesResponse | null;
  tomorrow: PrayerTimesResponse | null;
  monthly: PrayerCalendarResponse | null;
  liveCurrentPrayer: PrayerMoment | null;
  liveNextPrayer: PrayerMoment | null;
  cityComparisons: CityComparison[];
  lastUpdatedAt: Date | null;
  monthlyDate: Date;
  debounceTimer: number | null;
  countdownTimer: number | null;
  lastCurrentPrayerKey: string | null;
  lastVisualPrayerKey: string | null;
  sentNotificationKeys: Set<string>;
  deferredInstallPrompt: BeforeInstallPromptEvent | null;
  pwaInstallAvailable: boolean;
  serviceWorkerReady: boolean;
  activePresetId: string | null;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function createAppState(): AppState {
  const storedNotificationPrayers = readSetting(STORAGE_KEYS.notificationPrayerKeys, "fajr,maghrib")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as NotifiablePrayerKey[];

  return {
    methods: [],
    location: loadStoredLocation(),
    favorites: loadFavoriteLocations(),
    quickPresets: loadQuickPresets(),
    method: readSetting(STORAGE_KEYS.calculationMethod, "2"),
    school: readSetting(STORAGE_KEYS.school, "0"),
    language: readSetting(STORAGE_KEYS.language, "ru") as AppLanguage,
    theme: readSetting(STORAGE_KEYS.theme, "system"),
    timeFormat: readSetting(STORAGE_KEYS.timeFormat, "24h"),
    notificationsEnabled: readSetting(STORAGE_KEYS.notificationsEnabled, "false") === "true",
    notificationLeadMinutes: Number(readSetting(STORAGE_KEYS.notificationLeadMinutes, "15")),
    notificationPrayerKeys: storedNotificationPrayers.length ? storedNotificationPrayers : ["fajr", "maghrib"],
    notificationCurrentCityOnly: readSetting(STORAGE_KEYS.notificationCurrentCityOnly, "true") === "true",
    today: null,
    tomorrow: null,
    monthly: null,
    liveCurrentPrayer: null,
    liveNextPrayer: null,
    cityComparisons: [],
    lastUpdatedAt: null,
    monthlyDate: new Date(),
    debounceTimer: null,
    countdownTimer: null,
    lastCurrentPrayerKey: null,
    lastVisualPrayerKey: null,
    sentNotificationKeys: new Set<string>(),
    deferredInstallPrompt: null,
    pwaInstallAvailable: false,
    serviceWorkerReady: false,
    activePresetId: null,
  };
}
