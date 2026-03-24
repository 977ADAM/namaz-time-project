import { DEFAULT_LOCATION, STORAGE_KEYS } from "./constants.js";

export function loadStoredLocation() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedCity)) || DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

export function saveLocation(location) {
  localStorage.setItem(STORAGE_KEYS.selectedCity, JSON.stringify(location));
}

export function readSetting(key, fallback) {
  return localStorage.getItem(key) || fallback;
}

export function writeSetting(key, value) {
  localStorage.setItem(key, value);
}
