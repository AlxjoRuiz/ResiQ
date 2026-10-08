import type { ReactNode } from "react";
import { PropertyModuleShell } from "@/components/dashboard/property-module-shell";
import { requirePropertyMember } from "@/lib/auth/require-property-member";

export default async function PropertyLayout({ children, params }: { children: ReactNode; params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { property, membership } = await requirePropertyMember(propertyId);
  return <PropertyModuleShell propertyId={propertyId} propertyName={property.name} roles={membership.roles}>{children}</PropertyModuleShell>;
}
