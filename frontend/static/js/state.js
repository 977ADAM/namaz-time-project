import { STORAGE_KEYS } from "./constants.js";
import { loadStoredLocation, readSetting } from "./storage.js";

export function createAppState() {
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
    route: window.location.pathname,
  };
}
