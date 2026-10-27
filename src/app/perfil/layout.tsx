import type { ReactNode } from "react";
import styles from "@/components/dashboard/dashboard.module.css";
import { SeasonalDecor } from "@/components/seasonal/seasonal-decor";
import { createClient } from "@/lib/supabase/server";

// Solo el perfil del superadmin usa el fondo, recuadro y decoración del panel; las demás cuentas
// conservan el perfil sencillo (decisión de Alejandro, 27/10/2026).
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: platformAdmin } = user ? await supabase.from("platform_admins").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle() : { data: null };
  if (!platformAdmin) return children;
  return <div className={styles.panelSurface}><SeasonalDecor />{children}</div>;
}
