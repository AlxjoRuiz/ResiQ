"use client";

import { useEffect } from "react";
import { markLegalPropertySeen } from "./actions";

// Al abrir Novedades se marca la visita al conjunto (desde el navegador, para que la precarga de enlaces no
// la marque antes de tiempo).
export function MarkPropertySeen({ propertyId }: { propertyId: string }) {
  useEffect(() => { void markLegalPropertySeen(propertyId); }, [propertyId]);
  return null;
}
