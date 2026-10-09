const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export type LocalDateTimeResolution =
  | { kind: "invalid-timezone" | "invalid-date" | "nonexistent"; instants: [] }
  | { kind: "unique"; instants: [string] }
  | { kind: "ambiguous"; instants: [string, string] };

function createFormatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function isValidIanaTimeZone(timezone: string): boolean {
  try {
    createFormatter(timezone);
    return true;
  } catch {
    return false;
  }
}

function partsAt(formatter: Intl.DateTimeFormat, instant: number): string {
  const parts = formatter.formatToParts(new Date(instant));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}T${values.get("hour")}:${values.get("minute")}`;
}

export function resolveLocalDateTime(
  localDateTime: string,
  timezone: string,
): LocalDateTimeResolution {
  const match = LOCAL_DATE_TIME_PATTERN.exec(localDateTime);
  if (!match) return { kind: "invalid-date", instants: [] };

  const [, year, month, day, hour, minute] = match;
  const localEpoch = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  if (
    new Date(localEpoch).toISOString().slice(0, 16) !== localDateTime ||
    Number(hour) > 23 ||
    Number(minute) > 59
  ) {
    return { kind: "invalid-date", instants: [] };
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = createFormatter(timezone);
  } catch {
    return { kind: "invalid-timezone", instants: [] };
  }

  const offsets = new Set<number>();
  for (let delta = -36; delta <= 36; delta += 6) {
    const sample = localEpoch + delta * 60 * 60 * 1_000;
    const localParts = partsAt(formatter, sample);
    const [localDate, localTime] = localParts.split("T");
    const [localYear, localMonth, localDay] = localDate.split("-").map(Number);
    const [localHour, localMinute] = localTime.split(":").map(Number);
    const representedAsUtc = Date.UTC(
      localYear,
      localMonth - 1,
      localDay,
      localHour,
      localMinute,
    );
    offsets.add(representedAsUtc - sample);
  }

  const instants = [...offsets]
    .map((offset) => localEpoch - offset)
    .filter((instant) => partsAt(formatter, instant) === localDateTime)
    .sort((left, right) => left - right)
    .filter((instant, index, all) => index === 0 || instant !== all[index - 1])
    .map((instant) => new Date(instant).toISOString());

  if (instants.length === 0) return { kind: "nonexistent", instants: [] };
  if (instants.length === 1) return { kind: "unique", instants: [instants[0]] };
  if (instants.length === 2) return { kind: "ambiguous", instants: [instants[0], instants[1]] };
  return { kind: "invalid-date", instants: [] };
}

export function formatInstantForTimezone(isoInstant: string, timezone: string): string {
  const instant = new Date(isoInstant);
  const parts = createFormatter(timezone).formatToParts(instant);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}T${values.get("hour")}:${values.get("minute")}`;
}
