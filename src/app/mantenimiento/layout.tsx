import type { ReactNode } from "react";
import styles from "@/components/dashboard/dashboard.module.css";
import { SeasonalDecor } from "@/components/seasonal/seasonal-decor";

// Módulo de mantenimiento: mismo fondo, recuadro y decoración que el panel. La decoración no sale al imprimir el informe.
export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  return <div className={styles.panelSurface}><div className="print:hidden"><SeasonalDecor /></div>{children}</div>;
}
