import type { ReactNode } from "react";
import styles from "@/components/dashboard/dashboard.module.css";
import { SeasonalDecor } from "@/components/seasonal/seasonal-decor";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <div className={styles.panelSurface}><SeasonalDecor />{children}</div>;
}
