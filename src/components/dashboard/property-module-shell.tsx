"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, House, UserRound } from "lucide-react";
import { adminModules, conciergeModules, residentModules } from "./navigation";
import styles from "./dashboard.module.css";

export function PropertyModuleShell({ children, propertyId, propertyName, roles }: { children: ReactNode; propertyId: string; propertyName: string; roles: string[] }) {
  const pathname = usePathname();
  const base = `/panel/propiedades/${propertyId}`;
  if (pathname === `${base}/dashboard`) return children;
  const view = roles.includes("administrator") ? "administracion" : roles.includes("concierge") ? "porteria" : "residente";
  const label = view === "administracion" ? "Administración" : view === "porteria" ? "Portería" : "Residente";
  const modules = view === "administracion" ? adminModules(propertyId) : view === "porteria" ? conciergeModules(propertyId) : residentModules(propertyId);
  return <div className={styles.canvas}><div className={styles.shell}>
    <aside className={styles.sidebar}><Link href="/panel" className={styles.brand}><Building2 size={27} aria-hidden="true" />ResiQ</Link><p className={styles.sidebarLabel}>{label}</p><nav aria-label={`Navegación de ${label.toLowerCase()}`} className={styles.navigation}>
      <Link href={`${base}/dashboard`}><House size={19} aria-hidden="true" />Inicio</Link>
      {modules.filter((module) => module.href).map(({ title, href, icon: Icon }) => { const active = !href!.includes("?") && (pathname === href || (href !== base && pathname.startsWith(`${href}/`))); return <Link key={title} href={href!} aria-current={active ? "page" : undefined} className={active ? styles.activeLink : undefined}><Icon size={19} aria-hidden="true" />{title}</Link>; })}
      <Link href={`${base}/notificaciones`} aria-current={pathname.startsWith(`${base}/notificaciones`) ? "page" : undefined} className={pathname.startsWith(`${base}/notificaciones`) ? styles.activeLink : undefined}><Bell size={19} aria-hidden="true" />Notificaciones</Link>
      <Link href={`${base}/comunicados`} aria-current={pathname.startsWith(`${base}/comunicados`) ? "page" : undefined} className={pathname.startsWith(`${base}/comunicados`) ? styles.activeLink : undefined}><Bell size={19} aria-hidden="true" />Comunicados</Link>
    </nav><Link href="/panel" className={styles.communityLink}>← Mis comunidades</Link></aside>
    <div className={styles.content}><header className={styles.topbar}><div className={styles.property}><Building2 size={19} aria-hidden="true" /><span>{propertyName}</span></div><Link href="/perfil" className={styles.profileLink}><UserRound size={16} aria-hidden="true" />{label}</Link></header><div className={styles.moduleContent}>{children}</div></div>
  </div></div>;
}
