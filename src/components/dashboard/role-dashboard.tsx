import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import styles from "./dashboard.module.css";

export type DashboardModule = { title: string; description: string; icon: LucideIcon; href?: string };

// glass: tarjeta de vidrio azul claro que crece al pasar el cursor.
export function MetricCard({ label, value, glass = false }: { label: string; value: string | number; glass?: boolean }) {
  return <Card className={glass ? `${styles.glassCard} ${styles.glassHover}` : undefined}><CardContent><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>;
}
