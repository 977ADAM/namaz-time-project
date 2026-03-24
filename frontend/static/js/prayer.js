import { PRAYER_LABELS } from "./constants.js";
import { parsePrayerTime } from "./formatters.js";

export function getPrayerMoments(todayPayload, tomorrowPayload) {
  if (!todayPayload?.timings || !todayPayload?.meta?.timezone) {
    return [];
  }

  const timezone = todayPayload.meta.timezone;
  const moments = [
    ["fajr", todayPayload.requested_date, todayPayload.timings.fajr],
    ["dhuhr", todayPayload.requested_date, todayPayload.timings.dhuhr],
    ["asr", todayPayload.requested_date, todayPayload.timings.asr],
    ["maghrib", todayPayload.requested_date, todayPayload.timings.maghrib],
    ["isha", todayPayload.requested_date, todayPayload.timings.isha],
  ];

  if (tomorrowPayload?.timings?.fajr) {
    moments.push(["fajr", tomorrowPayload.requested_date, tomorrowPayload.timings.fajr]);
  }

  return moments
    .map(([key, targetDate, time]) => ({
      key,
      label: PRAYER_LABELS[key],
      time,
      date: targetDate,
      datetime: parsePrayerTime(targetDate, time, timezone),
    }))
    .filter((item) => item.datetime);
}

export function getPrayerState(todayPayload, tomorrowPayload) {
  const moments = getPrayerMoments(todayPayload, tomorrowPayload);
  const now = new Date();
  let current = null;
  let next = null;

  moments.forEach((moment) => {
    if (moment.datetime <= now) {
      current = moment;
    } else if (!next) {
      next = moment;
    }
  });

  return { current, next };
}
