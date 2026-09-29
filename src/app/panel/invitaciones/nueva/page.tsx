import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { InvitationCreateForm } from "./invitation-create-form";

export default async function NewInvitationPage({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  const propertyId = (await searchParams).property;
  if (!propertyId) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("property_members").select("roles").eq("property_id", propertyId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!membership?.roles.includes("administrator")) notFound();
  const { data: units } = await supabase.from("units").select("id,code").eq("property_id", propertyId).eq("status", "active").order("code");
  return <main className="mx-auto max-w-xl px-6 py-12"><Button asChild variant="ghost" size="sm"><Link href="/panel">← Volver</Link></Button><Card className="mt-5"><CardContent className="p-7"><h1 className="text-2xl font-semibold">Nueva invitación</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">El enlace solo funcionará con el correo indicado. El token no se volverá a mostrar.</p><InvitationCreateForm propertyId={propertyId} units={units ?? []} /></CardContent></Card></main>;
}
