// Fechas del Excel de cartera. El formato recomendado es DD/MM/AAAA, pero desde el 13/11/2026 (pedido de Alejandro) se
// acepta cualquier formato común:
// * Celdas de fecha de Excel (Date) y fechas guardadas como número de serie de Excel (46203 = 30/06/2026).
// * Día primero: 30/06/2026, 30-06-2026, 30.06.2026, 30/6/26 (año de 2 dígitos = 20xx).
// * Año primero: 2026-06-30, 2026/06/30.
// * Con hora al final: 30/06/2026 12:00, 2026-06-30T00:00:00.
// * Mes en palabras, en español o inglés: 30 de junio de 2026, 30-jun-2026, junio 30 2026, 30 jun 26, Jun 30, 2026.
// Las fechas que no existen (31/02/2026) se rechazan. Sin dependencias de Node para usarlo también en el navegador.

const monthNames: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1, feb: 2, febrero: 2, february: 2, mar: 3, marzo: 3, march: 3, abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, june: 6, jul: 7, julio: 7, july: 7, ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9, september: 9, oct: 10, octubre: 10, october: 10, nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12,
};

function isoFrom(year: number, month: number, day: number) {
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rechaza fechas que no existen, como 31/02/2026, y años fuera de lo razonable.
  if (year < 1900 || year > 2200 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return date.toISOString().slice(0, 10);
}

// Número de serie de Excel (días desde el 30/12/1899).
function fromSerial(serial: number) {
  if (!Number.isFinite(serial) || serial < 1 || serial > 120000) return "";
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return date.toISOString().slice(0, 10);
}

/** Devuelve la fecha como AAAA-MM-DD (para la base de datos) o "" si no es una fecha válida. */
export function dateValue(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "number") return fromSerial(value);
  let text = String(value ?? "").trim().toLowerCase();
  if (!text) return "";
  if (/^\d{4,6}(\.\d+)?$/.test(text)) return fromSerial(Number(text));
  // Quita la hora del final (12:00, 12:00:00, T00:00:00Z, a. m.).
  text = text.replace(/[t\s]+\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?\s*(z|[ap]\.?\s*m\.?)?$/, "").trim();
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (match) return isoFrom(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text);
  if (match) return isoFrom(Number(match[3]), Number(match[2]), Number(match[1]));
  // Mes en palabras: «30 de junio de 2026», «30-jun-2026», «junio 30 2026», «jun 30, 2026».
  const words = text.replace(/\bde(l)?\b/g, " ").replace(/[-/.,]/g, " ").replace(/\s+/g, " ").trim().split(" ");
  if (words.length === 3) {
    const [a, b, c] = words;
    if (/^\d{1,2}$/.test(a) && monthNames[b] && /^\d{2}(\d{2})?$/.test(c)) return isoFrom(Number(c), monthNames[b], Number(a));
    if (monthNames[a] && /^\d{1,2}$/.test(b) && /^\d{2}(\d{2})?$/.test(c)) return isoFrom(Number(c), monthNames[a], Number(b));
  }
  return "";
}

/** AAAA-MM-DD → DD/MM/AAAA, el formato con que se muestra y se descarga la cartera. */
export const displayDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso;
