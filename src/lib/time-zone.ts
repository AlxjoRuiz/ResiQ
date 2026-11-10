export const COLOMBIA_TIME_ZONE = "America/Bogota";

/** «Buenos días» (5 a. m. a 11:59 a. m.), «Buenas tardes» (12 m. a 6:59 p. m.) o «Buenas noches», en la hora del conjunto. */
export function greetingFor(date: Date, timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date));
  return hour >= 5 && hour < 12 ? "Buenos días" : hour >= 12 && hour < 19 ? "Buenas tardes" : "Buenas noches";
}

export function dateTimeFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone });
}

export function dateInputValue(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function dateTimeInputValue(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function timeZoneOffsetMinutes(at: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(at).map(({ type, value }) => [type, value]));
  return (Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - at.getTime()) / 60000;
}

/** Instante en que empieza el día `YYYY-MM-DD` en la zona horaria dada. */
export function zonedDayStart(day: string, timeZone: string) {
  const midnightUtc = new Date(`${day}T00:00:00Z`);
  return new Date(midnightUtc.getTime() - timeZoneOffsetMinutes(midnightUtc, timeZone) * 60000);
}

/** Suma días a una fecha `YYYY-MM-DD` sin depender de la zona horaria del servidor. */
export function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
