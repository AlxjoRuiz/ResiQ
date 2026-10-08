import type { ReactNode } from "react";
import styles from "@/components/dashboard/dashboard.module.css";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <div className={styles.panelSurface}>{children}</div>;
}
