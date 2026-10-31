import type { ReactNode } from "react";
import styles from "@/components/dashboard/dashboard.module.css";
import { SeasonalDecor } from "@/components/seasonal/seasonal-decor";
import { requireLegalStaff } from "@/lib/auth/require-legal-staff";
import { LegalShell } from "./legal-shell";

// Módulo jurídico (31/10/2026): la abogada de cobros de ResiQ, con el mismo fondo y marco que el panel.
// Solo ve los conjuntos que el superadmin le asigna; la base de datos lo vuelve a validar en cada consulta.
export default async function LegalLayout({ children }: { children: ReactNode }) {
  await requireLegalStaff();
  return <div className={styles.panelSurface}><SeasonalDecor /><LegalShell>{children}</LegalShell></div>;
}
