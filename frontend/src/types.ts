export type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

export interface LocationResult {
  id: string;
  city: string;
  country: string;
  region?: string | null;
  display_name: string;
  latitude: number;
  longitude: number;
  timezone?: string | null;
}

export interface MethodsResponse {
  methods: CalculationMethod[];
}

export interface CalculationMethod {
  id: number;
  code: string;
  name: string;
}

export interface PrayerDateInfo {
  readable: string;
  timestamp: string;
  gregorian: Record<string, string>;
  hijri: Record<string, string>;
}

export interface PrayerMeta {
  latitude: number;
  longitude: number;
  timezone: string;
  method: Record<string, unknown> & { name?: string };
}

export interface PrayerTimings {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface PrayerTimesResponse {
  requested_date: string;
  timings: PrayerTimings;
  date: PrayerDateInfo;
  meta: PrayerMeta;
}

export interface PrayerCalendarDay {
  requested_date: string;
  readable_date: string;
  hijri_date: string;
  weekday: string;
  timings: PrayerTimings;
}

export interface PrayerCalendarResponse {
  year: number;
  month: number;
  timezone: string;
  method: Record<string, unknown>;
  days: PrayerCalendarDay[];
}

export interface LocationSearchResponse {
  query: string;
  results: LocationResult[];
}

export interface PrayerMoment {
  key: PrayerKey;
  label: string;
  time: string;
  date: string;
  datetime: Date;
}
