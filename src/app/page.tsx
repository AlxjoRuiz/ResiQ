import { ArrowRight, Bell, Building2, CalendarDays, CheckCircle2, ClipboardList, KeyRound, Mail, Megaphone, MessageSquareText, Package, Scale, ShieldCheck, UserRound, UsersRound, Vote, Wallet, Wrench } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import styles from "./home.module.css";
import { Reveal } from "./reveal";

// Portada pública de ResiQ (10/11/2026, pedido de Alejandro): diseño en azul y blanco con animaciones suaves.
// Solo describe lo que la plataforma ya hace; el acceso sigue siendo por invitación.
const modules = [
  { icon: Wallet, title: "Cartera", description: "Estado de cuenta, comprobantes de pago y acuerdos de pago, claros para todos." },
  { icon: MessageSquareText, title: "PQRS", description: "Peticiones, quejas y reclamos con su seguimiento de principio a fin." },
  { icon: Package, title: "Paquetes", description: "Portería registra la llegada y el residente recibe el aviso al instante." },
  { icon: UsersRound, title: "Visitas", description: "Autoriza a tus visitantes y portería controla su entrada y salida." },
  { icon: CalendarDays, title: "Reservas", description: "Zonas comunes con su disponibilidad y reservas en pocos pasos." },
  { icon: Vote, title: "Asambleas", description: "Convocatorias, asistencia y votaciones en vivo de la comunidad." },
  { icon: Megaphone, title: "Comunicados", description: "Mensajes de la administración con archivos adjuntos para todos." },
  { icon: Bell, title: "Notificaciones", description: "Cada novedad de tu apartamento llega a tu bandeja de avisos." },
] as const;

const profiles = [
  { icon: Building2, title: "Administración", points: ["Cartera, mora y acuerdos de pago", "Censo y residentes del conjunto", "Comunicados, asambleas y llamados"] },
  { icon: UserRound, title: "Residentes", points: ["Tu estado de cuenta y comprobantes", "Paquetes, visitas y reservas", "Avisos de lo que pasa en tu comunidad"] },
  { icon: KeyRound, title: "Portería", points: ["Registro de paquetes y servicios", "Control de visitas autorizadas", "Todo desde el celular"] },
] as const;

const teams = [
  { icon: Scale, title: "Cobro jurídico", description: "La abogada ve la cartera en vivo y envía requerimientos de pago." },
  { icon: Wrench, title: "Mantenimiento", description: "Asistencia con foto, tareas con evidencia e informes del equipo." },
] as const;

const steps = [
  { icon: Mail, title: "Recibes tu invitación", description: "La administración de tu conjunto te invita con tu correo." },
  { icon: ShieldCheck, title: "Creas tu acceso", description: "Entras con el mismo correo y quedas ligado a tu apartamento." },
  { icon: CheckCircle2, title: "Tu comunidad, en un lugar", description: "Cartera, solicitudes, paquetes y avisos desde cualquier dispositivo." },
] as const;

export default function HomePage() {
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4">Saltar al contenido</a>
      <header className={`${styles.topbar} sticky top-0 z-40 border-b border-white/60`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <a href="#inicio" className="flex items-center gap-3 font-semibold"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/30"><Building2 size={22} aria-hidden="true" /></span><span className="text-lg tracking-tight">ResiQ</span></a>
          <nav aria-label="Secciones" className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#modulos" className="transition-colors hover:text-primary">Módulos</a>
            <a href="#perfiles" className="transition-colors hover:text-primary">Para quién</a>
            <a href="#como-funciona" className="transition-colors hover:text-primary">Cómo funciona</a>
          </nav>
          <Button asChild size="sm"><a href="/login">Ingresar <ArrowRight size={15} aria-hidden="true" /></a></Button>
        </div>
      </header>

      <main id="contenido">
        <section id="inicio" className={styles.hero}>
          <div aria-hidden="true" className={styles.grid} />
          <div aria-hidden="true" className={`${styles.blob} ${styles.blobOne}`} />
          <div aria-hidden="true" className={`${styles.blob} ${styles.blobTwo}`} />
          <div aria-hidden="true" className={`${styles.blob} ${styles.blobThree}`} />
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pt-14 pb-20 sm:px-10 sm:pt-20 sm:pb-28 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className={`${styles.rise} inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1.5 text-xs font-semibold text-primary`}><span className={`${styles.pulse} size-2 rounded-full bg-primary`} />Plataforma para propiedad horizontal en Colombia</p>
              <h1 className={`${styles.rise} ${styles.delay1} mt-6 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-6xl`}>Tu conjunto,<br />en orden y <span className={styles.gradientText}>conectado.</span></h1>
              <p className={`${styles.rise} ${styles.delay2} mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg`}>ResiQ reúne a la administración, los residentes y la portería en un solo lugar: cartera clara, solicitudes con seguimiento y cada novedad a tiempo.</p>
              <div className={`${styles.rise} ${styles.delay3} mt-9 flex flex-wrap items-center gap-3`}>
                <Button asChild className={`h-12 px-6 ${styles.shineButton} shadow-lg shadow-primary/25`}><a href="/login">Ingresar a ResiQ <ArrowRight size={17} aria-hidden="true" /></a></Button>
                <Button asChild variant="outline" className="h-12 bg-white/80 px-6"><a href="#modulos">Ver los módulos</a></Button>
              </div>
              <p className={`${styles.rise} ${styles.delay4} mt-6 flex items-center gap-2 text-sm text-muted-foreground`}><ShieldCheck size={17} className="text-primary" aria-hidden="true" />Acceso por invitación de la administración de tu conjunto.</p>
            </div>

            {/* Imagen del conjunto (10/11/2026): entra con la cascada, flota despacio y sus bordes se funden con el fondo. */}
            <div className={`${styles.rise} ${styles.delay2} relative mx-auto w-full max-w-xl`}>
              <div aria-hidden="true" className={styles.heroGlow} />
              <Image src="/images/conjunto-resiq.webp" alt="Conjunto residencial con tres torres, piscina y zonas verdes, junto a íconos de paquetes, reservas y pagos al día" width={1402} height={1122} priority sizes="(min-width: 1024px) 560px, 100vw" className={`${styles.heroImage} h-auto w-full`} />
            </div>
          </div>
        </section>

        <section id="modulos" className="scroll-mt-20 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Todo en un lugar</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Menos trámites. Más comunidad.</h2>
              <p className="mt-4 text-muted-foreground">Cada módulo está pensado para el día a día de un conjunto residencial.</p>
            </Reveal>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map(({ icon: Icon, title, description }, index) => <Reveal as="li" key={title} delay={(index % 4) as 0 | 1 | 2 | 3} className="h-full">
                <article className={`${styles.module} h-full rounded-2xl border bg-white p-6`}>
                  <span className={`${styles.moduleIcon} flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary`}><Icon size={22} aria-hidden="true" /></span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </article>
              </Reveal>)}
            </ul>
          </div>
        </section>

        <section id="perfiles" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Para cada persona del conjunto</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Cada quien ve lo que necesita.</h2>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {profiles.map(({ icon: Icon, title, points }, index) => <Reveal key={title} delay={index as 0 | 1 | 2}>
                <article className={`${styles.module} h-full rounded-2xl border bg-white p-7`}>
                  <span className={`${styles.moduleIcon} flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary`}><Icon size={22} aria-hidden="true" /></span>
                  <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                  <ul className="mt-4 grid gap-3 text-sm text-muted-foreground">{points.map((point) => <li key={point} className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{point}</li>)}</ul>
                </article>
              </Reveal>)}
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {teams.map(({ icon: Icon, title, description }, index) => <Reveal key={title} delay={index as 0 | 1}>
                <article className={`${styles.module} flex h-full items-center gap-5 rounded-2xl border bg-white p-6`}>
                  <span className={`${styles.moduleIcon} flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary`}><Icon size={22} aria-hidden="true" /></span>
                  <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
                </article>
              </Reveal>)}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Cómo funciona</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Empezar es muy sencillo.</h2>
            </Reveal>
            <ol className="relative mt-14 grid gap-10 md:grid-cols-3">
              <span aria-hidden="true" className="absolute top-7 right-[16%] left-[16%] hidden h-0.5 bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10 md:block" />
              {steps.map(({ icon: Icon, title, description }, index) => <Reveal as="li" key={title} delay={index as 0 | 1 | 2} className="relative text-center">
                <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30"><Icon size={24} aria-hidden="true" /><span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-white text-xs font-bold text-primary shadow">{index + 1}</span></span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
              </Reveal>)}
            </ol>
          </div>
        </section>

        <section className="px-6 py-20 sm:px-10 sm:py-24">
          <Reveal className={`${styles.cta} mx-auto max-w-6xl rounded-[32px] px-8 py-14 text-center text-white shadow-2xl shadow-primary/30 sm:px-16 sm:py-20`}>
            <ClipboardList size={36} className="mx-auto opacity-90" aria-hidden="true" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Un mejor lugar para vivir empieza con estar conectados.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/85">Si tu conjunto ya usa ResiQ, ingresa con el correo con el que te invitaron.</p>
            <Button asChild variant="outline" className={`h-12 px-6 ${styles.shineButton} mt-8 border-white bg-white text-primary hover:bg-white/90`}><a href="/login">Ingresar a ResiQ <ArrowRight size={17} aria-hidden="true" /></a></Button>
          </Reveal>
        </section>
      </main>

      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:px-10">
          <span className="flex items-center gap-2 font-semibold text-foreground"><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white"><Building2 size={17} aria-hidden="true" /></span>ResiQ</span>
          <span>Una comunidad mejor conectada · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </>
  );
}
