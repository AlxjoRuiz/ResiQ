"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Building2, FileBarChart, LogOut, MessagesSquare, Scale, UserRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import styles from "@/components/dashboard/dashboard.module.css";

const sections = [{ title: "Conjuntos", href: "/juridica", icon: Building2 }];

// Marco de la abogada (31/10/2026): la misma barra de secciones y el mismo recuadro que mantenimiento.
export function LegalShell({ children, threads }: { children: ReactNode; threads: { noticeId: string; propertyId: string; pending: boolean }[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Conjunto en el que se está: por la dirección, o por la conversación abierta.
  const segment = pathname.split("/")[2] ?? "";
  const openThread = pathname.startsWith("/juridica/respuestas/") ? threads.find((row) => row.noticeId === pathname.split("/")[3]) : undefined;
  const propertyId = openThread?.propertyId ?? (/^[0-9a-f-]{36}$/i.test(segment) ? segment : null);
  // Punto rojo mientras alguna conversación del conjunto espere respuesta de la abogada.
  const pending = propertyId ? threads.some((row) => row.propertyId === propertyId && row.pending) : false;
  const onReplies = Boolean(openThread) || (propertyId !== null && pathname === `/juridica/${propertyId}` && searchParams.get("tab") === "respuestas");
  const onReport = propertyId !== null && pathname === `/juridica/${propertyId}/informe`;
  const contentRef = useRef<HTMLDivElement>(null);
  // El contenido se desplaza dentro del recuadro: al cambiar de página vuelve arriba.
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [pathname]);
  return <div className={styles.canvas}><div className={styles.shell}>
    <aside className={styles.sidebar}><Link href="/juridica" className={styles.brand}><Building2 size={27} aria-hidden="true" />ResiQ</Link><p className={styles.sidebarLabel}>Jurídica</p>
      <nav aria-label="Navegación del módulo jurídico" className={styles.navigation}>
        {sections.map(({ title, href, icon: Icon }) => { const active = !onReplies && !onReport && (pathname === href || pathname.startsWith(`${href}/`)); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? styles.activeLink : undefined}><Icon size={19} aria-hidden="true" />{title}</Link>; })}
        {propertyId && <Link href={`/juridica/${propertyId}?tab=respuestas`} aria-current={onReplies ? "page" : undefined} className={onReplies ? styles.activeLink : undefined}><MessagesSquare size={19} aria-hidden="true" />Respuestas{pending && <span className={styles.unseenDot}><span className="sr-only">Hay respuestas por contestar</span></span>}</Link>}
        {/* Informe del conjunto (11/11/2026), debajo de Respuestas. */}
        {propertyId && <Link href={`/juridica/${propertyId}/informe`} aria-current={onReport ? "page" : undefined} className={onReport ? styles.activeLink : undefined}><FileBarChart size={19} aria-hidden="true" />Informe</Link>}
      </nav>
      <form action={signOut} className="mt-auto"><button className={`${styles.communityLink} flex items-center gap-2`}><LogOut size={15} aria-hidden="true" />Salir</button></form>
    </aside>
    <div ref={contentRef} className={styles.content}><header className={styles.topbar}><div className={styles.property}><Scale size={19} aria-hidden="true" /><span>Cobro jurídico ResiQ</span></div><Link href="/perfil" className={styles.profileLink}><UserRound size={16} aria-hidden="true" />Abogada</Link></header><div className={styles.moduleContent}>{children}</div></div>
  </div></div>;
}
