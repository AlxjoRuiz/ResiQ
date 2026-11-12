// Fechas del Excel de cartera (12/11/2026, pedido de Alejandro): el formato oficial es DD/MM/AAAA. También se
// aceptan las fechas de Excel (celdas tipo fecha), AAAA-MM-DD y DD-MM-AAAA o DD.MM.AAAA. Sin dependencias de Node
// para poder usarlo en la vista previa del navegador.

const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const dayFirstPattern = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

function isoFrom(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rechaza fechas que no existen, como 31/02/2026.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return date.toISOString().slice(0, 10);
}

/** Devuelve la fecha como AAAA-MM-DD (para la base de datos) o "" si no es una fecha válida. */
export function dateValue(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  const iso = isoPattern.exec(text);
  if (iso) return isoFrom(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dayFirst = dayFirstPattern.exec(text);
  if (dayFirst) return isoFrom(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  return "";
}

/** AAAA-MM-DD → DD/MM/AAAA, el formato con que se muestra y se descarga la cartera. */
export const displayDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso;
