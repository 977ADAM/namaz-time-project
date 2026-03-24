import { PRAYER_LABELS } from "./constants";
import { parsePrayerTime } from "./formatters";
import type { PrayerMoment, PrayerTimesResponse } from "./types";

interface PendingPrayerMoment extends Omit<PrayerMoment, "datetime"> {
  datetime: Date | null;
}

export function getPrayerMoments(
  todayPayload: PrayerTimesResponse | null,
  tomorrowPayload: PrayerTimesResponse | null
): PrayerMoment[] {
  if (!todayPayload?.timings || !todayPayload.meta?.timezone) {
    return [];
  }

  const timezone = todayPayload.meta.timezone;
  const moments: Array<[PrayerMoment["key"], string, string]> = [
    ["fajr", todayPayload.requested_date, todayPayload.timings.fajr],
    ["dhuhr", todayPayload.requested_date, todayPayload.timings.dhuhr],
    ["asr", todayPayload.requested_date, todayPayload.timings.asr],
    ["maghrib", todayPayload.requested_date, todayPayload.timings.maghrib],
    ["isha", todayPayload.requested_date, todayPayload.timings.isha],
  ];

  if (tomorrowPayload?.timings?.fajr) {
    moments.push(["fajr", tomorrowPayload.requested_date, tomorrowPayload.timings.fajr]);
  }

  const pendingMoments: PendingPrayerMoment[] = moments
    .map(([key, targetDate, time]) => ({
      key,
      label: PRAYER_LABELS[key],
      time,
      date: targetDate,
      datetime: parsePrayerTime(targetDate, time, timezone),
    }));

  return pendingMoments.filter(
    (item): item is PrayerMoment => item.datetime instanceof Date
  );
}

export function getPrayerState(
  todayPayload: PrayerTimesResponse | null,
  tomorrowPayload: PrayerTimesResponse | null
): { current: PrayerMoment | null; next: PrayerMoment | null } {
  const moments = getPrayerMoments(todayPayload, tomorrowPayload);
  const now = new Date();
  let current: PrayerMoment | null = null;
  let next: PrayerMoment | null = null;

  moments.forEach((moment) => {
    if (moment.datetime <= now) {
      current = moment;
    } else if (!next) {
      next = moment;
    }
  });

  return { current, next };
}
