import type { ReactNode } from "react";
import styles from "@/components/dashboard/dashboard.module.css";
import { SeasonalDecor } from "@/components/seasonal/seasonal-decor";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { LegalShell } from "./legal-shell";

// Módulo jurídico (31/10/2026): la abogada de cobros de ResiQ, con el mismo fondo y marco que el panel.
// Solo ve los conjuntos que el superadmin le asigna; la base de datos lo vuelve a validar en cada consulta.
export default async function LegalLayout({ children }: { children: ReactNode }) {
  const { supabase } = await requireLegalStaff();
  // Respuestas por conjunto (05/11/2026), para «Respuestas» en la barra cuando se está dentro de un conjunto.
  const { data } = await supabase.rpc("legal_list_threads");
  const threads = ((data ?? []) as { notice_id: string; property_id: string; unread: number }[]).map((row) => ({ noticeId: row.notice_id, propertyId: row.property_id, unread: row.unread }));
  return <div className={styles.panelSurface}><SeasonalDecor /><LegalShell threads={threads}>{children}</LegalShell></div>;
}
