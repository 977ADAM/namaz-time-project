export function formatTime(rawTime: string, timeFormat: string): string {
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

function getFormatterParts(date: Date, timezone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  return formatter.formatToParts(date).reduce<Record<string, string>>((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});
}

export function parsePrayerTime(dateString: string, timeString: string, timezone: string): Date | null {
  if (!dateString || !timeString || !timezone) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);
  let utcMillis = Date.UTC(year, month - 1, day, hours, minutes, 0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = getFormatterParts(new Date(utcMillis), timezone);
    const renderedMillis = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const targetMillis = Date.UTC(year, month - 1, day, hours, minutes, 0);
    const difference = targetMillis - renderedMillis;
    if (difference === 0) {
      break;
    }
    utcMillis += difference;
  }

  return new Date(utcMillis);
}

export function formatMonthYear(date: Date, locale = "ru-RU"): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}

export function getIsoDateInTimezone(timezone: string, sourceDate = new Date()): string {
  const parts = getFormatterParts(sourceDate, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}
