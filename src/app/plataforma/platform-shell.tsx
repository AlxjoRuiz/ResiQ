"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Building2, ChartNoAxesCombined, House, LogOut, Settings, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import styles from "@/components/dashboard/dashboard.module.css";

const sections = [
  { title: "Inicio", href: "/plataforma", icon: House },
  { title: "Conjuntos", href: "/plataforma/propiedades", icon: Building2 },
  { title: "Usuarios", href: "/plataforma/usuarios", icon: UsersRound },
  { title: "Equipos ResiQ", href: "/plataforma/equipos", icon: BriefcaseBusiness },
  { title: "Métricas", href: "/plataforma/metricas", icon: ChartNoAxesCombined },
  { title: "Configuración", href: "/plataforma/configuracion", icon: Settings },
];

// Marco del superadmin (30/10/2026): la misma barra de secciones a la izquierda y el mismo recuadro que
// el admin del conjunto y mantenimiento. En celular la barra queda arriba y se desplaza de lado.
export function PlatformShell({ children }: { children: ReactNode }) {
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
  return <div className={styles.canvas}><div className={styles.shell}>
    <aside className={styles.sidebar}><Link href="/plataforma" className={styles.brand}><Building2 size={27} aria-hidden="true" />ResiQ</Link><p className={styles.sidebarLabel}>Superadmin</p>
      <nav ref={navigationRef} aria-label="Navegación de la plataforma" className={styles.navigation}>
        {sections.map(({ title, href, icon: Icon }) => { const active = href === "/plataforma" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? styles.activeLink : undefined}><Icon size={19} aria-hidden="true" />{title}</Link>; })}
      </nav>
      <form action={signOut} className="mt-auto"><button className={`${styles.communityLink} flex items-center gap-2`}><LogOut size={15} aria-hidden="true" />Salir</button></form>
    </aside>
    <div ref={contentRef} className={styles.content}><header className={styles.topbar}><div className={styles.property}><ShieldCheck size={19} aria-hidden="true" /><span>Plataforma ResiQ</span></div><Link href="/perfil" className={styles.profileLink}><UserRound size={16} aria-hidden="true" />Superadmin</Link></header><div className={styles.moduleContent}>{children}</div></div>
  </div></div>;
}
