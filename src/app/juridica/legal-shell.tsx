"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LogOut, Scale, UserRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import styles from "@/components/dashboard/dashboard.module.css";

const sections = [{ title: "Conjuntos", href: "/juridica", icon: Building2 }];

// Marco de la abogada (31/10/2026): la misma barra de secciones y el mismo recuadro que mantenimiento.
export function LegalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);
  // El contenido se desplaza dentro del recuadro: al cambiar de página vuelve arriba.
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [pathname]);
  return <div className={styles.canvas}><div className={styles.shell}>
    <aside className={styles.sidebar}><Link href="/juridica" className={styles.brand}><Building2 size={27} aria-hidden="true" />ResiQ</Link><p className={styles.sidebarLabel}>Jurídica</p>
      <nav aria-label="Navegación del módulo jurídico" className={styles.navigation}>
        {sections.map(({ title, href, icon: Icon }) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? styles.activeLink : undefined}><Icon size={19} aria-hidden="true" />{title}</Link>; })}
      </nav>
      <form action={signOut} className="mt-auto"><button className={`${styles.communityLink} flex items-center gap-2`}><LogOut size={15} aria-hidden="true" />Salir</button></form>
    </aside>
    <div ref={contentRef} className={styles.content}><header className={styles.topbar}><div className={styles.property}><Scale size={19} aria-hidden="true" /><span>Cobro jurídico ResiQ</span></div><Link href="/perfil" className={styles.profileLink}><UserRound size={16} aria-hidden="true" />Abogada</Link></header><div className={styles.moduleContent}>{children}</div></div>
  </div></div>;
}
