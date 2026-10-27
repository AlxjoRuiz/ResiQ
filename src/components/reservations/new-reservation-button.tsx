"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// «Nueva reserva». Si la mora bloquea al residente, en vez de abrir el formulario muestra el aviso
// centrado en la pantalla con el contenido desenfocado detrás (mismo diseño que desvincular).
export function NewReservationButton({ propertyId, blockedDays, initiallyOpen = false }: { propertyId: string; blockedDays: number | null; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen && blockedDays !== null);
  if (blockedDays === null) return <Button asChild><Link href={`/panel/propiedades/${propertyId}/reservas/nueva`}>Nueva reserva</Link></Button>;
  return <>
    <Button type="button" onClick={() => setOpen(true)}>Nueva reserva</Button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="No puedes hacer reservas">
      <div className="w-full max-w-md space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-lg">
        <p>No puedes hacer reservas porque tu apartamento está en mora: tiene una deuda con {blockedDays} o más días de vencida. Ponte al día en Cartera para volver a reservar.</p>
        <div className="flex flex-wrap gap-2"><Button asChild size="sm"><Link href={`/panel/propiedades/${propertyId}/cartera`}>Ver mi cartera</Link></Button><Button type="button" size="sm" variant="outline" autoFocus onClick={() => setOpen(false)}>Cerrar</Button></div>
      </div>
    </div>}
  </>;
}
