import { redirect } from "next/navigation";

export default async function LegacyCensusPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  redirect(`/panel/propiedades/${propertyId}`);
}
