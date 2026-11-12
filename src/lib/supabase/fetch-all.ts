// Supabase devuelve como máximo 1.000 filas por consulta (12/11/2026: por eso la importación de cartera de
// Bonavento, con 1.860 apartamentos, decía que «no existe» la mitad). Esta función pide las filas de 1.000 en 1.000
// hasta traerlas todas. La consulta debe tener un orden estable (por ejemplo .order("id")) para no repetir ni saltar.
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function fetchAllRows<T>(page: (from: number, to: number) => Page<T>, pageSize = 1000, maxRows = 50000) {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}
