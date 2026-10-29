"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ClipboardList, Clock3, FileSpreadsheet, FileWarning, House, LogOut, UserRound, UsersRound, Wrench } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import styles from "@/components/dashboard/dashboard.module.css";

const sections = [
  { title: "Inicio", href: "/mantenimiento", icon: House },
  { title: "Trabajadores", href: "/mantenimiento/trabajadores", icon: UsersRound },
  { title: "Asistencia", href: "/mantenimiento/asistencia", icon: Clock3 },
  { title: "Tareas", href: "/mantenimiento/tareas", icon: ClipboardList },
  { title: "Llamados de atención", href: "/mantenimiento/llamados", icon: FileWarning },
  { title: "Informe mensual", href: "/mantenimiento/informe", icon: FileSpreadsheet },
];

// Marco del admin de mantenimiento (28/10/2026): misma barra de secciones a la izquierda y mismo
// recuadro que el panel del admin del conjunto. La vista para imprimir el informe va sin marco.
export function MaintenanceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // En celular la barra es horizontal: se desplaza hasta la sección abierta.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    const navigation = navigationRef.current;
    const active = navigation?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!navigation || !active) return;
    const navigationBox = navigation.getBoundingClientRect(), activeBox = active.getBoundingClientRect();
    navigation.scrollTo({ left: navigation.scrollLeft + activeBox.left - navigationBox.left - (navigationBox.width - activeBox.width) / 2, behavior: "auto" });
  }, [pathname]);
  // El contenido se desplaza dentro del recuadro: al cambiar de sección vuelve arriba.
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [pathname]);
  if (pathname.startsWith("/mantenimiento/informe/imprimir")) return children;
  return <div className={styles.canvas}><div className={styles.shell}>
    <aside className={styles.sidebar}><Link href="/mantenimiento" className={styles.brand}><Building2 size={27} aria-hidden="true" />ResiQ</Link><p className={styles.sidebarLabel}>Mantenimiento</p>
      <nav ref={navigationRef} aria-label="Navegación de mantenimiento" className={styles.navigation}>
        {sections.map(({ title, href, icon: Icon }) => { const active = href === "/mantenimiento" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? styles.activeLink : undefined}><Icon size={19} aria-hidden="true" />{title}</Link>; })}
      </nav>
      <form action={signOut} className="mt-auto"><button className={`${styles.communityLink} flex items-center gap-2`}><LogOut size={15} aria-hidden="true" />Salir</button></form>
    </aside>
    <div ref={contentRef} className={styles.content}><header className={styles.topbar}><div className={styles.property}><Wrench size={19} aria-hidden="true" /><span>Equipo de mantenimiento ResiQ</span></div><Link href="/perfil" className={styles.profileLink}><UserRound size={16} aria-hidden="true" />Admin de mantenimiento</Link></header><div className={styles.moduleContent}>{children}</div></div>
  </div></div>;
}
