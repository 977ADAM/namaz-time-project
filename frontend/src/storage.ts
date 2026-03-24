import { DEFAULT_LOCATION, STORAGE_KEYS } from "./constants";
import type { LocationResult } from "./types";

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

export function readSetting(key: string, fallback: string): string {
  return localStorage.getItem(key) || fallback;
}

export function writeSetting(key: string, value: string): void {
  localStorage.setItem(key, value);
}
