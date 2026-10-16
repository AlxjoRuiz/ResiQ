import { notFound, redirect } from "next/navigation";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";

export default async function NewInvitationPage({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  const propertyId = (await searchParams).property;
  if (!propertyId) notFound();
  await requirePropertyAdmin(propertyId);
  redirect(`/panel/propiedades/${propertyId}#invitaciones`);
}
