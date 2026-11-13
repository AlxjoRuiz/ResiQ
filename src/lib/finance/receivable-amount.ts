// Valor de una fila del Excel de cartera (13/11/2026, pedido de Alejandro). Además de los números de Excel, entiende
// valores escritos como texto al estilo colombiano: «$ 128.000», «128.000», «128,000», «1.250.000,50», «COP 52.610»,
// «-84.147» o «(84.147)» (negativo = saldo a favor). Devuelve NaN si no es un valor. Sin dependencias de Node.

export function amountValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  let text = String(value ?? "").trim();
  if (!text) return NaN;
  let negative = false;
  if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1); }
  text = text.replace(/cop/gi, "").replace(/\$/g, "").replace(/\s+/g, "");
  if (text.startsWith("-")) { negative = !negative; text = text.slice(1); }
  if (!/^[0-9.,]+$/.test(text) || !/[0-9]/.test(text)) return NaN;
  const dots = (text.match(/\./g) ?? []).length, commas = (text.match(/,/g) ?? []).length;
  let normalized: string;
  if (dots && commas) {
    // El último separador es el de los decimales: 1.250.000,50 o 1,250,000.50.
    const decimal = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = text.split(thousands).join("").replace(decimal, ".");
  } else if (dots || commas) {
    const separator = dots ? "." : ",";
    // Solo grupos de tres después del separador (128.000 o 1.250.000): son miles. Si no (1234,5): decimales.
    const thousandsPattern = separator === "." ? /^\d{1,3}(\.\d{3})+$/ : /^\d{1,3}(,\d{3})+$/;
    normalized = thousandsPattern.test(text) ? text.split(separator).join("") : (dots + commas === 1 ? text.replace(",", ".") : "");
  } else normalized = text;
  const result = normalized ? Number(normalized) : NaN;
  return Number.isFinite(result) ? (negative ? -result : result) : NaN;
}
