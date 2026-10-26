// Importación de cartera sin tope de envío (decisión de Alejandro, 25/10/2026). La base de datos
// no limita las filas; el lector del Excel conserva un máximo de seguridad contra archivos
// maliciosos: 5000 filas, el mayor que admite boundedXlsx, por encima de los 2000 apartamentos
// del censo.
export const FINANCE_MAX_ROWS = 5000;
export const FINANCE_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const FINANCE_MAX_FILE_LABEL = "4 MB";
export const financeXlsxLimits = {
  maxRows: FINANCE_MAX_ROWS,
  maxInputBytes: FINANCE_MAX_FILE_BYTES,
  maxEntryBytes: 12 * 1024 * 1024,
  maxExpandedBytes: 32 * 1024 * 1024,
};
