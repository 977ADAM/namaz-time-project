import { PRAYER_LABELS } from "./constants";
import { parsePrayerTime } from "./formatters";
import type { PrayerMoment, PrayerTimesResponse } from "./types";

interface PendingPrayerMoment extends Omit<PrayerMoment, "datetime"> {
  datetime: Date | null;
}

function buildPrayerMoments(
  items: ReadonlyArray<readonly [PrayerMoment["key"], string, string]>,
  timezone: string
): PrayerMoment[] {
  const pendingMoments: PendingPrayerMoment[] = items
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
  if (!todayPayload?.times || !todayPayload.location?.timezone) {
    return { current: null, next: null };
  }

  const timezone = todayPayload.location.timezone;
  const currentMoments = buildPrayerMoments(
    [
      ["fajr", todayPayload.date.gregorian, todayPayload.times.fajr],
      ["dhuhr", todayPayload.date.gregorian, todayPayload.times.dhuhr],
      ["asr", todayPayload.date.gregorian, todayPayload.times.asr],
      ["maghrib", todayPayload.date.gregorian, todayPayload.times.maghrib],
      ["isha", todayPayload.date.gregorian, todayPayload.times.isha],
    ],
    timezone
  );
  const nextMoments = buildPrayerMoments(
    [
      ["fajr", todayPayload.date.gregorian, todayPayload.times.fajr],
      ["dhuhr", todayPayload.date.gregorian, todayPayload.times.dhuhr],
      ["asr", todayPayload.date.gregorian, todayPayload.times.asr],
      ["maghrib", todayPayload.date.gregorian, todayPayload.times.maghrib],
      ["isha", todayPayload.date.gregorian, todayPayload.times.isha],
      ...(tomorrowPayload?.times?.fajr
        ? ([["fajr", tomorrowPayload.date.gregorian, tomorrowPayload.times.fajr]] as const)
        : []),
    ],
    timezone
  );
  const now = new Date();
  let current: PrayerMoment | null = null;
  let next: PrayerMoment | null = null;

  currentMoments.forEach((moment) => {
    if (moment.datetime <= now) {
      current = moment;
    }
  });

  nextMoments.forEach((moment) => {
    if (!next && moment.datetime > now) {
      next = moment;
    }
  });

  return { current, next };
}
