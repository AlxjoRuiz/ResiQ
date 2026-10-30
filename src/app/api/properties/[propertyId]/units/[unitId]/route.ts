import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Datos de UN apartamento para la página Propiedad (29/10/2026): censo, residentes vinculados e
// invitación. Antes la página armaba esto para todos los apartamentos a la vez (unos 10 MB en un
// conjunto de 1.000); ahora se pide solo al abrir el apartamento. Solo administración activa del conjunto.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] ?? null : value);

type MemberRow = { id: string; user_id: string; roles: string[]; status: string; profiles: { display_name: string } | { display_name: string }[] | null; unit_memberships: { id: string; relationship: string }[] | null };
type CensusRow = { id: string; import_id: string; full_name: string | null; email_normalized: string | null; invitation_primary: boolean; invitation_relationship: string | null; cells: unknown };
type InvitationRow = { unit_id: string; invitation_id: string; email: string; relationship: string; invitation_status: string; delivery_status: string | null };

export async function GET(_: Request, { params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
  const { propertyId, unitId } = await params;
  if (!uuidPattern.test(propertyId) || !uuidPattern.test(unitId)) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const { data: member } = await supabase.from("property_members").select("roles").eq("property_id", propertyId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member || !(member.roles as string[]).includes("administrator")) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const [unitResult, censusResult, memberResult, invitationResult] = await Promise.all([
    supabase.from("units").select("id,status,buildings(active)").eq("property_id", propertyId).eq("id", unitId).maybeSingle(),
    supabase.from("census_records").select("id,import_id,full_name,email_normalized,invitation_primary,invitation_relationship,cells").eq("property_id", propertyId).eq("unit_id", unitId),
    // Solo quien tiene un vínculo vigente con ESTE apartamento.
    supabase.from("property_members").select("id,user_id,roles,status,profiles!property_members_user_id_fkey(display_name),unit_memberships!inner(id,relationship)").eq("property_id", propertyId).eq("unit_memberships.unit_id", unitId).is("unit_memberships.valid_to", null),
    supabase.rpc("get_unit_invitations", { target_property_id: propertyId }),
  ]);
  if (unitResult.error || censusResult.error || memberResult.error || invitationResult.error) return NextResponse.json({ error: "No pudimos cargar el apartamento." }, { status: 500 });
  if (!unitResult.data) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const records = (censusResult.data ?? []) as CensusRow[];
  const importIds = [...new Set(records.map((record) => record.import_id))];
  const { data: imports, error: importError } = importIds.length
    ? await supabase.from("census_imports").select("id,headers").eq("property_id", propertyId).in("id", importIds)
    : { data: [], error: null };
  if (importError) return NextResponse.json({ error: "No pudimos cargar el apartamento." }, { status: 500 });
  const headersByImport = new Map((imports ?? []).map((item) => [item.id as string, Array.isArray(item.headers) ? item.headers.map(String) : []]));

  // Residentes del apartamento (no administración ni portería), con su correo de acceso.
  const residents = ((memberResult.data ?? []) as MemberRow[]).filter((row) => row.roles.includes("member") && !row.roles.includes("administrator") && !row.roles.includes("concierge"));
  const admin = residents.length ? createAdminClient() : null;
  const occupants = !admin ? [] : await Promise.all(residents.flatMap((row) => (row.unit_memberships ?? []).map(async (link) => {
    const { data, error } = await admin.auth.admin.getUserById(row.user_id);
    return { linkId: link.id, relationship: link.relationship, name: one(row.profiles)?.display_name ?? "Miembro", email: error ? null : data.user?.email ?? null, status: row.status };
  })));

  const invitation = ((invitationResult.data ?? []) as InvitationRow[]).find((item) => item.unit_id === unitId) ?? null;
  return NextResponse.json({
    unitActive: unitResult.data.status === "active",
    buildingActive: Boolean(one(unitResult.data.buildings as { active: boolean } | { active: boolean }[] | null)?.active),
    records: records.map((record) => ({ id: record.id, name: record.full_name, email: record.email_normalized, primary: record.invitation_primary, relationship: record.invitation_relationship, headers: headersByImport.get(record.import_id) ?? [], cells: Array.isArray(record.cells) ? record.cells.map((value) => value === null ? null : String(value)) : [] })),
    occupants,
    invitation: invitation && { id: invitation.invitation_id, email: invitation.email, relationship: invitation.relationship, status: invitation.invitation_status, delivery: invitation.delivery_status },
  }, { headers: { "cache-control": "no-store" } });
}
