import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";
import { EndMembershipForm, MemberForm, UnitMembershipForm } from "../../management-forms";

type NamedBuilding = { name: string };
type LinkedUnit = { id: string; code: string; buildings: NamedBuilding | NamedBuilding[] | null };
type UnitLink = { id: string; relationship: string; valid_from: string; valid_to: string | null; units: LinkedUnit | LinkedUnit[] | null };
type Member = { id: string; roles: string[]; status: string; joined_at: string; profiles: { display_name: string } | { display_name: string }[] | null; unit_memberships: UnitLink[] | null };

function relationLabel(value: string) { return value === "owner" ? "Propietario" : "Residente"; }
function single<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }

export default async function PropertyMembersPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, property } = await requirePropertyAdmin(propertyId);
  const [{ data: memberData }, { data: unitData }] = await Promise.all([
    supabase.from("property_members").select("id,roles,status,joined_at,profiles(display_name),unit_memberships(id,relationship,valid_from,valid_to,units(id,code,buildings(name)))").eq("property_id", propertyId).order("joined_at"),
    supabase.from("units").select("id,code,buildings(name)").eq("property_id", propertyId).eq("status", "active").order("code"),
  ]);
  const members = (memberData ?? []) as Member[];
  const units = (unitData ?? []).map((unit) => {
    const building = single(unit.buildings as NamedBuilding | NamedBuilding[] | null);
    return { id: unit.id, label: `${building?.name ?? "Torre"} · ${unit.code}` };
  });

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 sm:px-10">
    <Button asChild variant="ghost" size="sm"><Link href={`/panel/propiedades/${propertyId}`}>← Volver a {property.name}</Link></Button>
    <header className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">Accesos</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Miembros y apartamentos</h1><p className="mt-2 text-sm text-muted-foreground">Una persona puede pertenecer a varias propiedades y tener varios vínculos.</p></div><Button asChild><Link href={`/panel/invitaciones/nueva?property=${propertyId}`}>Invitar miembro</Link></Button></header>
    <section className="mt-8 space-y-5">{members.map((member) => {
      const profile = single(member.profiles);
      const isAdministrator = member.roles.includes("administrator");
      const activeLinks = (member.unit_memberships ?? []).filter((link) => !link.valid_to);
      return <Card key={member.id}><CardContent><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{profile?.display_name ?? "Miembro"}</h2><p className="mt-1 text-sm text-muted-foreground">Roles: {member.roles.join(", ")}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{member.status}</span></div>{isAdministrator ? <p className="mt-4 rounded-lg border p-3 text-sm text-muted-foreground">La administración no puede modificar ni revocar a otros administradores desde esta pantalla.</p> : <><MemberForm propertyId={propertyId} member={member} />{member.roles.includes("member") && member.status === "active" && <UnitMembershipForm propertyId={propertyId} memberId={member.id} units={units} />}</>}<div className="mt-5 border-t pt-4"><p className="text-sm font-medium">Vínculos vigentes</p><div className="mt-3 space-y-2">{activeLinks.map((link) => { const unit = single(link.units); const building = single(unit?.buildings ?? null); return <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"><span>{building?.name ?? "Torre"} · {unit?.code ?? "Unidad"} · {relationLabel(link.relationship)}</span>{!isAdministrator && <EndMembershipForm propertyId={propertyId} unitMembershipId={link.id} />}</div>; })}{!activeLinks.length && <p className="text-sm text-muted-foreground">Sin apartamentos vinculados actualmente.</p>}</div></div></CardContent></Card>;
    })}{!members.length && <Card><CardContent><p className="text-sm text-muted-foreground">No hay miembros registrados.</p></CardContent></Card>}</section>
  </main>;
}
