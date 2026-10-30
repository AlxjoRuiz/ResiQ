import type { ReactNode } from "react";
import styles from "@/components/dashboard/dashboard.module.css";
import { SeasonalDecor } from "@/components/seasonal/seasonal-decor";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { PlatformShell } from "./platform-shell";

// Mismo fondo y decoración que el panel. Desde el 30/10/2026 con la barra de secciones del superadmin
// (Inicio, Conjuntos, Usuarios, Equipos ResiQ, Métricas y Configuración). Solo superadmin.
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();
  return <div className={styles.panelSurface}><SeasonalDecor /><PlatformShell>{children}</PlatformShell></div>;
}
