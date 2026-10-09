import Link from "next/link";
import { notFound } from "next/navigation";
import { RegisterPackageForm, type PackageDirectoryRow } from "@/components/packages/package-forms";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

export default async function NewPackagePage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, membership, property } = await requirePropertyMember(propertyId);
  if (!membership.roles.some((role: string) => role === "administrator" || role === "concierge")) notFound();
  const { data, error } = await supabase.rpc("get_package_registration_directory", { target_property_id: propertyId });
  if (error) throw new Error("No se pudo cargar el directorio de apartamentos.");
  const directory = (data ?? []) as PackageDirectoryRow[];
  return <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:px-10"><Link href={`/panel/propiedades/${propertyId}/paquetes`} className="text-sm text-muted-foreground hover:text-foreground">← Paquetes y recibos de {property.name}</Link><section className="mt-6 rounded-2xl border bg-card p-6 sm:p-8"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Portería</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Registrar llegada</h1><p className="mt-2 mb-7 text-sm text-muted-foreground">Selecciona si llegó un paquete o un recibo físico de luz, gas o agua. Elige el apartamento y, si aparece, el destinatario para crear su aviso.</p>{directory.length ? <RegisterPackageForm propertyId={propertyId} directory={directory} /> : <p className="rounded-xl bg-secondary p-4 text-sm">No hay apartamentos activos disponibles.</p>}</section></main>;
}
