import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportReceivablesForm } from "@/components/finance/finance-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

export default async function ImportFinancePage({params}:{params:Promise<{propertyId:string}>}){
  const{propertyId}=await params;const{membership,property}=await requirePropertyMember(propertyId);if(!membership.roles.includes("administrator"))notFound();
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-8 sm:px-10"><header className="border-b pb-6"><Link href={`/panel/propiedades/${propertyId}/cartera`} className="text-sm text-muted-foreground hover:text-foreground">← Cartera de {property.name}</Link><p className="mt-5 text-xs font-semibold tracking-wider text-primary uppercase">Carga masiva</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Importar obligaciones desde Excel</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Revisa la vista previa antes de confirmar. El servidor valida nuevamente todas las filas y guarda el lote completo o ninguno.</p></header><section className="mt-7"><Card><CardContent><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">1. Descarga la plantilla</h2><p className="mt-1 text-sm text-muted-foreground">No cambies los encabezados. Usa “obligacion” o “saldo_inicial” en la columna tipo.</p></div><Button asChild variant="outline"><a href="/api/templates/cartera">Descargar .xlsx</a></Button></div><div className="my-6 border-t"/><h2 className="text-lg font-semibold">2. Revisa y confirma el archivo</h2><div className="mt-5"><ImportReceivablesForm propertyId={propertyId}/></div></CardContent></Card></section></main>;
}
