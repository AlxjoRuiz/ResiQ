import type { ReactNode } from "react";
import { PropertyModuleShell } from "@/components/dashboard/property-module-shell";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

export default async function PropertyLayout({ children, params }: { children: ReactNode; params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { supabase, property, membership } = await requirePropertyMember(propertyId);
  // Secciones con algo nuevo sin ver: muestran un punto en la barra lateral.
  const { data: unseen } = await supabase.rpc("get_unseen_sections", { target_property_id: propertyId });
  return <PropertyModuleShell propertyId={propertyId} propertyName={property.name} roles={membership.roles} unseenSections={Array.isArray(unseen) ? unseen.map(String) : []}>{children}</PropertyModuleShell>;
}
