"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, Building2, House, Megaphone, UserRound } from "lucide-react";
import { adminModules, conciergeModules, residentModules } from "./navigation";
import styles from "./dashboard.module.css";
import { markSectionSeen } from "@/app/panel/propiedades/[propertyId]/section-seen-actions";

export function PropertyModuleShell({ children, propertyId, propertyName, roles, unseenSections = [] }: { children: ReactNode; propertyId: string; propertyName: string; roles: string[]; unseenSections?: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [returnContext, setReturnContext] = useState<{ noticeId: string; section: string } | null>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const base = `/panel/propiedades/${propertyId}`;
  const section = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/")[0] : "";
  const originNoticeId = searchParams.get("desdeAviso");
  const validNoticeId = originNoticeId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(originNoticeId) ? originNoticeId : null;
  if (validNoticeId && section && section !== "notificaciones" && section !== "dashboard") {
    if (returnContext?.noticeId !== validNoticeId || returnContext.section !== section) {
      setReturnContext({ noticeId: validNoticeId, section });
    }
  } else if (returnContext && returnContext.section !== section) {
    setReturnContext(null);
  }
  useEffect(() => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    const navigation = navigationRef.current;
    const active = navigation?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!navigation || !active) return;
    const navigationBox = navigation.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    navigation.scrollTo({
      left: navigation.scrollLeft + activeBox.left - navigationBox.left - (navigationBox.width - activeBox.width) / 2,
      behavior: "auto",
    });
  }, [pathname]);
  // Punto de «algo nuevo sin ver»: al abrir la sección se quita aquí y se guarda en el servidor.
  const [unseen, setUnseen] = useState(() => new Set(unseenSections));
  if (unseen.has(section)) { const next = new Set(unseen); next.delete(section); setUnseen(next); }
  useEffect(() => { if (unseenSections.includes(section)) void markSectionSeen(propertyId, section); }, [section, propertyId, unseenSections]);
  const dot = (name: string) => unseen.has(name) ? <span className={styles.unseenDot}><span className="sr-only">Hay algo nuevo</span></span> : null;
  // El contenido se desplaza dentro del recuadro: al cambiar de sección vuelve arriba.
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [pathname]);
  if (pathname === `${base}/dashboard`) return children;
  const noticeReturnId = section !== "notificaciones" && section !== "dashboard" && (validNoticeId || (returnContext?.section === section ? returnContext.noticeId : null));
  const view = roles.includes("administrator") ? "administracion" : roles.includes("concierge") ? "porteria" : "residente";
  const label = view === "administracion" ? "Administración" : view === "porteria" ? "Portería" : "Residente";
  const modules = view === "administracion" ? adminModules(propertyId) : view === "porteria" ? conciergeModules(propertyId) : residentModules(propertyId);
  return <div className={styles.canvas}><div className={styles.shell}>
    <aside className={styles.sidebar}><Link href="/panel" className={styles.brand}><Building2 size={27} aria-hidden="true" />ResiQ</Link><p className={styles.sidebarLabel}>{label}</p><nav ref={navigationRef} aria-label={`Navegación de ${label.toLowerCase()}`} className={styles.navigation}>
      <Link href={`${base}/dashboard`}><House size={19} aria-hidden="true" />Inicio</Link>
      {modules.filter((module) => module.href).map(({ title, href, icon: Icon }) => { const active = !href!.includes("?") && (pathname === href || (href !== base && pathname.startsWith(`${href}/`))); return <Link key={title} href={href!} aria-current={active ? "page" : undefined} className={active ? styles.activeLink : undefined}><Icon size={19} aria-hidden="true" />{title}{dot(href!.slice(base.length + 1).split(/[/?]/)[0])}</Link>; })}
      <Link href={`${base}/notificaciones`} aria-current={pathname.startsWith(`${base}/notificaciones`) ? "page" : undefined} className={pathname.startsWith(`${base}/notificaciones`) ? styles.activeLink : undefined}><Bell size={19} aria-hidden="true" />Notificaciones{dot("notificaciones")}</Link>
      <Link href={`${base}/comunicados`} aria-current={pathname.startsWith(`${base}/comunicados`) ? "page" : undefined} className={pathname.startsWith(`${base}/comunicados`) ? styles.activeLink : undefined}><Megaphone size={19} aria-hidden="true" />Comunicados{dot("comunicados")}</Link>
    </nav><Link href="/panel" className={styles.communityLink}>← Mis comunidades</Link></aside>
    <div ref={contentRef} className={styles.content}><header className={styles.topbar}><div className={styles.property}><Building2 size={19} aria-hidden="true" /><span>{propertyName}</span></div><Link href="/perfil" className={styles.profileLink}><UserRound size={16} aria-hidden="true" />{label}</Link></header><div className={styles.moduleContent}>{noticeReturnId && <Link href={`${base}/notificaciones/${noticeReturnId}`} className="my-4 inline-flex rounded-lg border px-3 py-2 text-sm font-medium text-primary hover:bg-muted">← Volver al aviso</Link>}{children}</div></div>
  </div></div>;
}
