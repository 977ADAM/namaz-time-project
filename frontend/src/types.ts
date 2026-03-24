export type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
export type NotifiablePrayerKey = Exclude<PrayerKey, "sunrise">;

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

export interface ApiDateInfo {
  gregorian: string;
  hijri: string;
}

export interface PrayerMeta {
  latitude: number;
  longitude: number;
  timezone: string;
  method: Record<string, unknown> & { name?: string };
}

export interface ApiLocation {
  id?: string | null;
  city: string;
  country: string;
  region?: string | null;
  lat: number;
  lng: number;
  timezone: string;
}

export interface ApiMethod {
  id: string;
  name: string;
  provider_id: number;
}

export interface PrayerTimings {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface PrayerNameValue {
  key: PrayerKey;
  label: string;
  time: string;
}

export interface PrayerTimesResponse {
  location: ApiLocation;
  date: ApiDateInfo;
  method: ApiMethod;
  times: PrayerTimings;
  current_prayer?: PrayerNameValue | null;
  next_prayer?: PrayerNameValue | null;
  next_prayer_date?: string | null;
}

export interface LegacyPrayerTimesResponse {
  requested_date: string;
  timings: PrayerTimings;
  date: PrayerDateInfo;
  meta: PrayerMeta;
}

export interface PrayerCalendarDay {
  date: string;
  weekday: string;
  hijri: string;
  times: PrayerTimings;
}

export interface PrayerCalendarResponse {
  location: ApiLocation;
  year: number;
  month: number;
  method: ApiMethod;
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

export interface QuickPreset {
  id: string;
  label: string;
  location: LocationResult | null;
  assignable: boolean;
}
