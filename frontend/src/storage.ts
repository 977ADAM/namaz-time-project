import { DEFAULT_LOCATION, QUICK_PRESET_DEFAULTS, STORAGE_KEYS } from "./constants";
import type { LocationResult, QuickPreset } from "./types";

export function loadStoredLocation(): LocationResult {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedCity) ?? "null") as LocationResult | null) ?? DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

export function saveLocation(location: LocationResult): void {
  localStorage.setItem(STORAGE_KEYS.selectedCity, JSON.stringify(location));
}

export function loadFavoriteLocations(): LocationResult[] {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEYS.favoriteCities) ?? "[]") as LocationResult[]) ?? [];
  } catch {
    return [];
  }
}

export function saveFavoriteLocations(locations: LocationResult[]): void {
  localStorage.setItem(STORAGE_KEYS.favoriteCities, JSON.stringify(locations));
}

export function loadQuickPresets(): QuickPreset[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.quickPresetLocations) ?? "{}") as Record<
      string,
      LocationResult | null
    >;
    return QUICK_PRESET_DEFAULTS.map((preset) => ({
      ...preset,
      location: Object.prototype.hasOwnProperty.call(saved, preset.id) ? saved[preset.id] : preset.location,
    }));
  } catch {
    return QUICK_PRESET_DEFAULTS.map((preset) => ({ ...preset }));
  }
}

export function saveQuickPresets(presets: QuickPreset[]): void {
  const payload = presets.reduce<Record<string, LocationResult | null>>((accumulator, preset) => {
    if (preset.assignable) {
      accumulator[preset.id] = preset.location;
    }
    return accumulator;
  }, {});
  localStorage.setItem(STORAGE_KEYS.quickPresetLocations, JSON.stringify(payload));
}

export function readSetting(key: string, fallback: string): string {
  return localStorage.getItem(key) || fallback;
}

export function writeSetting(key: string, value: string): void {
  localStorage.setItem(key, value);
}
