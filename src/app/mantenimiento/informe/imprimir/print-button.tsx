"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return <Button onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Imprimir o guardar PDF</Button>;
}
