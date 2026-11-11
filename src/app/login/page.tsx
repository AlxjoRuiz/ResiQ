import { Building2, ShieldCheck } from "lucide-react";
import { Instrument_Serif } from "next/font/google";
import Link from "next/link";
import styles from "./login.module.css";
import { LoginForm } from "./login-form";
import { safeNext } from "@/lib/auth/safe-next";
import { accessErrorMessages } from "@/lib/auth/app-access";
import { createAdminClient } from "@/lib/supabase/admin";

// Cursiva serif del acento, la misma de la portada (se sirve desde la misma web).
const serif = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin"], display: "swap" });
// «Tu comunidad. Más cerca.»: cada palabra entra con desenfoque, 100 ms después de la anterior.
const headline = [["Tu", "comunidad."], ["Más", "cerca."]].map((line, lineIndex) =>
  line.map((word, index) => ({ word, delay: 0.2 + 0.1 * (lineIndex * 2 + index), accent: lineIndex === 1 })));

// Correo al que se envió la invitación (04/11/2026), para dejarlo fijo en «Crear cuenta con invitación».
// null = la invitación venció o no existe; undefined = no se pudo consultar (el formulario sigue igual).
async function invitedEmail(token: string) {
  try {
    const { data, error } = await createAdminClient().rpc("invitation_signup_target", { invitation_token: token });
    if (error) return undefined;
    return (Array.isArray(data) ? (data[0] as { email?: string } | undefined)?.email : undefined) ?? null;
  } catch { return undefined; }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; reset?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const invitationToken = next.startsWith("/invitacion?") ? new URL(next, "http://localhost").searchParams.get("token") ?? undefined : undefined;
  const invited = invitationToken ? await invitedEmail(invitationToken) : undefined;
  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <Link href="/" className={`${styles.back} ${styles.rise}`}><span className={styles.backIcon}><Building2 size={17} aria-hidden="true" /></span>ResiQ</Link>
      <div className={styles.layout}>
        {/* Presentación (11/11/2026): mismo estilo de la portada; el título entra palabra por palabra. */}
        <section className={styles.introduction} aria-label="ResiQ, tu comunidad">
          <p className={`${styles.chip} ${styles.rise} ${styles.delay1}`}><span className={styles.chipTag}><span className={styles.pulse} />En línea</span>Un espacio para tu comunidad</p>
          <p className={styles.headline}>{headline.map((line, lineIndex) => <span key={lineIndex} className="block">{line.map(({ word, delay, accent }) => <span key={word} className={`${styles.word} ${accent ? `${styles.serif} ${serif.className} pr-1` : ""}`} style={{ animationDelay: `${delay}s` }}>{word}{" "}</span>)}</span>)}</p>
          <p className={`${styles.description} ${styles.rise} ${styles.delay2}`}>Las novedades de tu conjunto, tus solicitudes y lo que necesitas para tu día a día, en un solo lugar.</p>
        </section>
        <section className={`${styles.card} ${styles.rise} ${styles.delay3}`} aria-labelledby="login-title">
          <div className={styles.cardBrand}><span className={styles.brandIcon}><Building2 size={24} strokeWidth={1.7} /></span><div><p className="font-semibold">ResiQ</p><p className={styles.subtitle}>Acceso de la comunidad</p></div></div>
          <h1 id="login-title" className={styles.title}>Bienvenido de nuevo</h1>
          <p className={styles.welcome}>Ingresa con la cuenta asociada a tu invitación.</p>
          {params.error && <p role="alert" className={styles.error}>{accessErrorMessages[params.error] ?? "No pudimos completar el acceso. Intenta nuevamente."}</p>}
          {params.reset === "success" && <p role="status" className={styles.success}>Contraseña actualizada. Ya puedes iniciar sesión.</p>}
          <LoginForm next={next} invitationToken={invitationToken} invitedEmail={invited} />
          {process.env.PASSWORD_RECOVERY_ENABLED === "true" && <p className={styles.recovery}><Link href="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link></p>}
          <p className={styles.security}><ShieldCheck size={16} aria-hidden="true" />Acceso protegido para miembros autorizados.</p>
        </section>
      </div>
    </main>
  );
}
