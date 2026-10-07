import { Building2, ShieldCheck } from "lucide-react";
import styles from "./login.module.css";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/panel";
  const invitationToken = next.startsWith("/invitacion?") ? new URL(next, "http://localhost").searchParams.get("token") ?? undefined : undefined;
  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.layout}>
        <section className={styles.introduction} aria-label="ResiQ, tu comunidad">
          <div className={styles.brand}><span className={styles.brandIcon}><Building2 size={25} strokeWidth={1.7} /></span><span>ResiQ</span></div>
          <p className={styles.eyebrow}>UN ESPACIO PARA TU COMUNIDAD</p>
          <p className={styles.headline}>Tu comunidad.<br /><span>Más cerca.</span></p>
          <p className={styles.description}>Las novedades de tu conjunto, tus solicitudes y lo que necesitas para tu día a día, en un solo lugar.</p>
          <div className={styles.community}><span className={styles.dot} />Conectados con tu hogar.</div>
        </section>
        <section className={styles.card} aria-labelledby="login-title">
          <div className={styles.cardBrand}><span className={styles.brandIcon}><Building2 size={24} strokeWidth={1.7} /></span><div><p className="font-semibold">ResiQ</p><p className={styles.subtitle}>Acceso de la comunidad</p></div></div>
          <h1 id="login-title" className={styles.title}>Bienvenido de nuevo</h1>
          <p className={styles.welcome}>Ingresa con la cuenta asociada a tu invitación.</p>
          {params.error && <p role="alert" className={styles.error}>No pudimos completar el acceso. Intenta nuevamente.</p>}
          <LoginForm next={next} invitationToken={invitationToken} />
          <p className={styles.security}><ShieldCheck size={16} aria-hidden="true" />Acceso protegido para miembros autorizados.</p>
        </section>
      </div>
    </main>
  );
}
