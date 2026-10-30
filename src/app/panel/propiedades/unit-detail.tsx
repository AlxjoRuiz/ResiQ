"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { House } from "lucide-react";
import { CensusDetail } from "@/components/census/census-detail";
import { EndMembershipForm, RevealInvitationLinkForm, UnitResidentInvitationForm } from "./management-forms";

// Apartamento de la página Propiedad que carga su contenido al abrirlo (29/10/2026). Antes la página
// traía el censo, residentes e invitación de todos los apartamentos de una vez (unos 10 MB en un conjunto
// de 1.000). Los datos vienen de /api/properties/[propertyId]/units/[unitId].
type Occupant = { linkId: string; relationship: string; name: string; email: string | null; status: string };
type Invitation = { id: string; email: string; relationship: string; status: string; delivery: string | null };
type UnitData = {
  unitActive: boolean; buildingActive: boolean; occupants: Occupant[]; invitation: Invitation | null;
  records: { id: string; name: string | null; email: string | null; primary: boolean; relationship: string | null; headers: string[]; cells: (string | null)[] }[];
};

function invitationLabel(invitation: Invitation) {
  if (invitation.status === "accepted") return "Invitación aceptada";
  if (invitation.status === "revoked") return "Invitación cancelada";
  if (invitation.status === "expired") return "Enlace vencido: genera uno nuevo";
  if (invitation.delivery === "held") return "Invitación retenida · modo de prueba, no se envió correo";
  if (invitation.delivery === "queued" || invitation.delivery === "processing") return "Invitación en cola de envío";
  if (invitation.delivery === "accepted") return "Correo de invitación enviado";
  if (invitation.delivery === "failed") return "No se pudo enviar el correo";
  return "Invitación pendiente";
}

function invitationOpen(invitation: Invitation | null) {
  return invitation?.status === "pending" || invitation?.status === "expired";
}

function InvitationStatus({ invitation, propertyId }: { invitation: Invitation; propertyId: string }) {
  return <div className="min-w-0 space-y-2 rounded-lg border p-3 text-sm">
    <p className="font-medium">{invitationLabel(invitation)}</p>
    <p className="break-all text-muted-foreground">{invitation.email} · {invitation.relationship === "owner" ? "Propietario" : "Residente"}</p>
    {invitationOpen(invitation) && <RevealInvitationLinkForm propertyId={propertyId} invitationId={invitation.id} />}
  </div>;
}

function OccupantCard({ occupant, propertyId }: { occupant: Occupant; propertyId: string }) {
  return <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{occupant.name}</p><p className="break-all text-sm text-muted-foreground">{occupant.email ?? "Correo no disponible"}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{occupant.relationship === "owner" ? "Propietario" : "Arrendatario"}</span></div>
    <p className="mt-2 text-sm">Estado: <strong>{occupant.status === "active" ? "Activo" : "Inactivo"}</strong></p>
    <div className="mt-3 border-t pt-3"><p className="mb-3 text-xs text-muted-foreground">Desvincular libera este apartamento. Si era el último vínculo del residente, también se retira su acceso; para volver a asignarlo se envía una invitación.</p><EndMembershipForm propertyId={propertyId} unitMembershipId={occupant.linkId} /></div>
  </div>;
}

function UnitContent({ data, propertyId, unitId }: { data: UnitData; propertyId: string; unitId: string }) {
  const { records, occupants, invitation } = data;
  const vacant = !occupants.length && !invitationOpen(invitation);
  const residents = occupants.map((occupant) => ({ linkId: occupant.linkId, label: `${occupant.name}${occupant.email ? ` (${occupant.email})` : ""}` }));
  const showAccess = (occupants.length > 0 && !records.length) || invitationOpen(invitation) || (!records.length && data.buildingActive && data.unitActive);
  return <>
    <div className="space-y-4"><h4 className="font-semibold">Información del Excel</h4>
      {records.map((record, index) => <div key={record.id} className="min-w-0 rounded-lg border p-2 sm:p-4">
        {!vacant && <p className="mb-4 font-medium">{record.name || record.email || `Residente ${index + 1}`}{record.primary && <span className="mt-1 block w-fit rounded-full bg-secondary px-2 py-1 text-xs sm:ml-2 sm:mt-0 sm:inline">Principal para futura invitación · {record.relationship === "owner" ? "Propietario" : "Arrendatario"}</span>}</p>}
        {record.headers.length ? <CensusDetail headers={record.headers} cells={record.cells} propertyId={propertyId} recordId={record.id} residents={residents} vacant={vacant} /> : <p className="text-sm text-muted-foreground">No se pudieron mostrar los encabezados de esta respuesta.</p>}
      </div>)}
      {!records.length && <p className="text-sm text-muted-foreground">Este apartamento no tiene respuestas importadas.</p>}
    </div>
    {showAccess && <div className="space-y-3 border-t pt-4"><h4 className="font-semibold">Vinculaciones y acceso a ResiQ</h4>
      {!records.length && occupants.map((occupant) => <OccupantCard key={occupant.linkId} occupant={occupant} propertyId={propertyId} />)}
      {!occupants.length && <>
        <p className="text-sm text-muted-foreground">Sin residente vinculado. Un correo del Excel no concede acceso hasta aceptar la invitación.</p>
        {invitation && invitationOpen(invitation) && <InvitationStatus invitation={invitation} propertyId={propertyId} />}
        {data.buildingActive && data.unitActive && !invitationOpen(invitation) && !records.length && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Agregar residente</summary><div className="mt-3"><UnitResidentInvitationForm propertyId={propertyId} unitId={unitId} /></div></details>}
      </>}
    </div>}
  </>;
}

// refreshKey cambia cada vez que el servidor vuelve a dibujar la página (por ejemplo, después de guardar
// el censo o desvincular): si el apartamento ya se había cargado, se vuelve a pedir para no mostrar datos viejos.
export function LazyUnit({ propertyId, unit, refreshKey }: { propertyId: string; unit: { id: string; code: string; floor: string | null; kind: string | null }; refreshKey: string }) {
  const [data, setData] = useState<UnitData | null>(null);
  const [error, setError] = useState(false);
  const loaded = useRef(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const load = useCallback(async () => {
    setError(false);
    try {
      const response = await fetch(`/api/properties/${propertyId}/units/${unit.id}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json() as UnitData);
      loaded.current = true;
    } catch { setError(true); }
  }, [propertyId, unit.id]);
  // Recarga si el servidor volvió a dibujar la página; y si el apartamento se abrió antes de que la página
  // terminara de cargar (celular lento), el aviso de apertura se perdió: se carga al activarse.
  useEffect(() => { if (loaded.current || detailsRef.current?.open) void load(); }, [refreshKey, load]);

  return <details ref={detailsRef} id={`apartamento-${unit.id}`} className="min-w-0 rounded-lg border bg-background" onToggle={(event) => { if (event.currentTarget.open && !loaded.current) void load(); }}>
    <summary className="flex cursor-pointer list-none items-center gap-3 p-3 marker:hidden sm:p-4"><House size={17} aria-hidden="true" className="shrink-0 text-primary" /><span className="min-w-0 flex-1 font-medium">Apartamento {unit.code}{unit.kind && <span className="font-normal text-muted-foreground"> · {unit.kind}</span>}</span><span aria-hidden="true" className="text-muted-foreground">▾</span></summary>
    <div className="min-w-0 space-y-4 border-t p-2 sm:p-4">
      <p className="text-sm"><strong>Número:</strong> {unit.code} <span className="mx-2">·</span> <strong>Piso:</strong> {unit.floor || "Sin información"}</p>
      {data ? <UnitContent data={data} propertyId={propertyId} unitId={unit.id} />
        : error ? <p role="alert" className="text-sm text-destructive">No pudimos cargar este apartamento. <button type="button" className="underline" onClick={() => void load()}>Intentar de nuevo</button></p>
        : <p role="status" className="text-sm text-muted-foreground">Cargando información del apartamento…</p>}
    </div>
  </details>;
}
