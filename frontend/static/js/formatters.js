export function formatTime(rawTime, timeFormat) {
  if (!rawTime) {
    return "--";
  }

  const [hoursString, minutes] = rawTime.split(":");
  const hours = Number(hoursString);
  if (timeFormat === "24h") {
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${minutes} ${suffix}`;
}

export function parsePrayerTime(dateString, timeString, timezone) {
  if (!dateString || !timeString || !timezone) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const tzDate = new Date(utcDate.toLocaleString("en-US", { timeZone: timezone }));
  const localDate = new Date(
    utcDate.toLocaleString("en-US", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  );
  return new Date(utcDate.getTime() - (tzDate.getTime() - localDate.getTime()));
}

export function formatMonthYear(date, locale = "ru-RU") {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}
