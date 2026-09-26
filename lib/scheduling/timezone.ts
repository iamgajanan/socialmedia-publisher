const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone: string | null | undefined): string {
  const candidate = timeZone?.trim() || "Asia/Kolkata";
  return isValidTimeZone(candidate) ? candidate : "Asia/Kolkata";
}

export function formatTimeZoneName(timeZone: string): string {
  const normalized = normalizeTimeZone(timeZone);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: normalized,
    timeZoneName: "long",
  }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value ?? normalized;
}

export function zonedDateTimeToUtc(value: string, timeZone: string): Date | null {
  const match = DATE_TIME_PATTERN.exec(value);
  if (!match) return null;

  const [, yearString, monthString, dayString, hourString, minuteString] = match;
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);
  const hour = Number(hourString);
  const minute = Number(minuteString);
  const normalized = normalizeTimeZone(timeZone);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = new Date(target);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: normalized,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(guess);

    const values = Object.fromEntries(
      parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
    );
    const represented = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute);
    guess = new Date(target - (represented - guess.getTime()));
  }

  const roundTrip = new Intl.DateTimeFormat("sv-SE", {
    timeZone: normalized,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(guess).replace(" ", "T");

  return roundTrip === value ? guess : null;
}
