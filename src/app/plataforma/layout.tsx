import type { ReactNode } from "react";
import styles from "@/components/dashboard/dashboard.module.css";
import { SeasonalDecor } from "@/components/seasonal/seasonal-decor";

// Mismo fondo y decoración que el panel, para que la plataforma se vea igual que al iniciar sesión.
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <div className={styles.panelSurface}><SeasonalDecor />{children}</div>;
}
