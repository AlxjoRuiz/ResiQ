import type { ReactNode } from "react";
import styles from "@/components/dashboard/dashboard.module.css";
import { SeasonalDecor } from "@/components/seasonal/seasonal-decor";
import { requireMaintenanceStaff } from "@/lib/auth/require-maintenance-staff";
import { MaintenanceShell } from "./maintenance-shell";

// Módulo de mantenimiento: mismo fondo, recuadro y decoración que el panel. La decoración no sale al
// imprimir el informe. El admin de mantenimiento ve la barra de secciones a la izquierda, como el admin
// del conjunto; el trabajador conserva la vista sencilla para celular.
export default async function MaintenanceLayout({ children }: { children: ReactNode }) {
  const { staff } = await requireMaintenanceStaff();
  return <div className={styles.panelSurface}><div className="print:hidden"><SeasonalDecor /></div>{staff.role === "admin" ? <MaintenanceShell>{children}</MaintenanceShell> : children}</div>;
}
