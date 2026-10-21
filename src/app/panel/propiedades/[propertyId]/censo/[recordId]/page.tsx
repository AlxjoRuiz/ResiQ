import { redirect } from "next/navigation";

export default async function LegacyCensusRecordPage({ params }: { params: Promise<{ propertyId: string; recordId: string }> }) {
  const { propertyId } = await params;
  redirect(`/panel/propiedades/${propertyId}`);
}
