import { redirect } from "next/navigation";
import { requirePropertyAdmin } from "@/lib/auth/require-property-admin";

export default async function PropertyMembersPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  await requirePropertyAdmin(propertyId);
  redirect(`/panel/propiedades/${propertyId}#residentes`);
}
