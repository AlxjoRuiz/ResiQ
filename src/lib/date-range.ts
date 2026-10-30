import { addDays, zonedDayStart } from "@/lib/time-zone";

// Filtro de fechas de las listas (29/10/2026): lee ?desde=&hasta= (AAAA-MM-DD, ambos días incluidos) y
// devuelve los instantes de inicio y fin en la zona horaria del conjunto, para filtrar en la consulta
// con .gte(columna, start).lt(columna, end). Si falta o no es válido, no hay filtro.
const validDay = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export type DateFilter = { from: string; to: string; start: string; end: string };

export function readDateFilter(params: { desde?: string; hasta?: string }, timeZone: string): DateFilter | null {
  if (!validDay(params.desde) || !validDay(params.hasta)) return null;
  const [from, to] = params.desde! <= params.hasta! ? [params.desde!, params.hasta!] : [params.hasta!, params.desde!];
  return { from, to, start: zonedDayStart(from, timeZone).toISOString(), end: zonedDayStart(addDays(to, 1), timeZone).toISOString() };
}

// Límites para la consulta: sin filtro, un rango que lo abarca todo (las columnas filtradas son
// obligatorias, así que no se pierde ningún registro).
export function dateBounds(filter: DateFilter | null): [string, string] {
  return filter ? [filter.start, filter.end] : ["1970-01-01T00:00:00.000Z", "9999-12-31T00:00:00.000Z"];
}

// Para listas que ya vienen cargadas (p. ej. desde una función de la base): ¿el instante cae en el rango?
export function inDateFilter(iso: string | null | undefined, filter: DateFilter | null) {
  if (!filter) return true;
  const at = iso ? Date.parse(iso) : NaN;
  return at >= Date.parse(filter.start) && at < Date.parse(filter.end);
}
