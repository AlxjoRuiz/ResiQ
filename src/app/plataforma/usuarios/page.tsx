import { PlatformPage } from "@/components/dashboard/platform-page";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

type PropertyRow = { property_id: string; property_name: string; city: string | null; property_status: string; unit_count: number; resident_count: number; concierge_count: number; administrator_count: number };
type CountKey = "unit_count" | "resident_count" | "concierge_count" | "administrator_count";
const columns: [string, CountKey][] = [["Apartamentos", "unit_count"], ["Residentes", "resident_count"], ["Portería", "concierge_count"], ["Administradores", "administrator_count"]];

// Solo cantidades por conjunto: sin nombres ni correos de residentes.
export default async function PlatformUsersPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("platform_list_properties");
  if (error) throw new Error("No se pudieron cargar las cifras.");
  const rows = (data ?? []) as PropertyRow[];
  const total = (key: CountKey) => rows.reduce((sum, row) => sum + row[key], 0);
  return <PlatformPage title="Usuarios" description="Cuentas activas por conjunto. Solo cifras, sin datos personales de los residentes.">
    <section className="grid gap-4 sm:grid-cols-4">{columns.map(([label, key]) => <Card key={key}><CardContent><p className="text-2xl font-semibold">{total(key)}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>)}</section>
    <Card><CardContent className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Conjunto</th>{columns.map(([label]) => <th key={label} className="py-2 pr-3 font-medium">{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.property_id} className="border-b last:border-0"><td className="py-3 pr-3"><p className="font-medium">{row.property_name}</p><p className="text-xs text-muted-foreground">{row.city ?? "Sin ciudad"}{row.property_status !== "active" ? " · Suspendido" : ""}</p></td>{columns.map(([, key]) => <td key={key} className="py-3 pr-3">{row[key]}</td>)}</tr>)}</tbody></table>
      {!rows.length && <p className="py-4 text-sm text-muted-foreground">Todavía no hay conjuntos.</p>}</CardContent></Card>
  </PlatformPage>;
}
