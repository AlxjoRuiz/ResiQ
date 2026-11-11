"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// Abre la ventana de impresión: ahí se elige «Guardar como PDF» para descargar el informe.
export function PrintButton() {
  return <Button onClick={() => window.print()}><Download size={16} aria-hidden="true" />Descargar PDF</Button>;
}
