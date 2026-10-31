import type { ReactNode } from "react";
import styles from "@/components/dashboard/dashboard.module.css";
import { SeasonalDecor } from "@/components/seasonal/seasonal-decor";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { LegalShell } from "./legal-shell";

// Módulo jurídico (31/10/2026): la abogada de cobros de ResiQ, con el mismo fondo y marco que el panel.
// Solo ve los conjuntos que el superadmin le asigna; la base de datos lo vuelve a validar en cada consulta.
export default async function LegalLayout({ children }: { children: ReactNode }) {
  const { supabase } = await requireLegalStaff();
  // Respuestas sin leer de los residentes (31/10/2026), para la barra; si falla, la barra sale sin el número.
  const { data } = await supabase.rpc("legal_unread_replies");
  return <div className={styles.panelSurface}><SeasonalDecor /><LegalShell unread={typeof data === "number" ? data : 0}>{children}</LegalShell></div>;
}
