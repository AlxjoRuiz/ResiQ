import { ArrowDown, ArrowRight, Bell, Building2, CalendarDays, CheckCircle2, KeyRound, Mail, Megaphone, MessageSquareText, Package, ShieldCheck, UserRound, UsersRound, Vote, Wallet } from "lucide-react";
import { Instrument_Serif } from "next/font/google";
import Image from "next/image";
import liftCard from "@/components/ui/lift-card.module.css";
import styles from "./home.module.css";
import { Reveal } from "./reveal";

// Portada pública de ResiQ (11/11/2026, pedido de Alejandro): azul y blanco, sobre conjuntos residenciales.
// Solo describe lo que la plataforma ya hace; el acceso sigue siendo por invitación.
// Cursiva serif para las palabras de acento; la fuente se sirve desde la misma web (la CSP no permite otras).
const serif = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin"], display: "swap" });

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

const steps = [
  { icon: Mail, title: "Recibes tu invitación", description: "La administración de tu conjunto te invita con tu correo." },
  { icon: ShieldCheck, title: "Creas tu acceso", description: "Entras con el mismo correo y quedas ligado a tu apartamento." },
  { icon: CheckCircle2, title: "Tu comunidad, en un lugar", description: "Cartera, solicitudes, paquetes y avisos desde cualquier dispositivo." },
] as const;

// Avisos de ejemplo de la maqueta del celular (así se ven en ResiQ).
const notices = [
  { icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700", title: "¡Estás al día!", detail: "Cartera · Torre A · 101", time: "Ahora" },
  { icon: Package, tone: "bg-primary/10 text-primary", title: "Paquete en portería", detail: "Llegó a las 9:42 a. m.", time: "5 min" },
  { icon: CalendarDays, tone: "bg-primary/10 text-primary", title: "Reserva aprobada", detail: "Salón social · sábado 6 p. m.", time: "1 h" },
  { icon: Megaphone, tone: "bg-primary/10 text-primary", title: "Nuevo comunicado", detail: "Mantenimiento de la piscina", time: "Ayer" },
] as const;

// Titular: cada palabra entra con desenfoque, 100 ms después de la anterior; «conectado.» va en cursiva azul.
const headline = [["Tu", "conjunto,"], ["en", "orden", "y"], ["conectado."]].map((line, lineIndex, lines) =>
  line.map((word, index) => ({ word, delay: 0.15 + 0.1 * (lines.slice(0, lineIndex).flat().length + index) })));

export default function HomePage() {
  return (
    <div className={styles.page}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4">Saltar al contenido</a>

      {/* Barra flotante en píldora. */}
      <header className={`${styles.rise} sticky top-3 z-40 px-4 sm:top-4 sm:px-6`}>
        <div className={`${styles.navPill} mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full py-2 pr-2 pl-4`}>
          <a href="#inicio" className="flex items-center gap-2.5 font-semibold"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white"><Building2 size={19} aria-hidden="true" /></span><span className="text-[17px] tracking-tight">ResiQ</span></a>
          <nav aria-label="Secciones" className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#tu-dia" className="transition-colors hover:text-primary">Tu día</a>
            <a href="#modulos" className="transition-colors hover:text-primary">Módulos</a>
            <a href="#perfiles" className="transition-colors hover:text-primary">Para quién</a>
            <a href="#como-funciona" className="transition-colors hover:text-primary">Cómo funciona</a>
          </nav>
          <a href="/login" className={`${styles.pillButton} ${styles.pillButtonSmall}`}>Ingresar<span className={styles.pillArrow}><ArrowRight size={15} aria-hidden="true" /></span></a>
        </div>
      </header>

      <main id="contenido">
        {/* Encabezado principal: texto a la izquierda, el conjunto a la derecha. */}
        <section id="inicio" className={`${styles.hero} -mt-20 pt-20`}>
          <div aria-hidden="true" className={styles.heroBackdrop} />
          <div aria-hidden="true" className={styles.dots} />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-14 pb-10 sm:px-10 sm:pt-20 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className={`${styles.rise} ${styles.delay1} inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 py-1 pr-3 pl-1 text-[13px] text-slate-700 shadow-sm`}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white"><span className={`${styles.pulse} size-1.5 rounded-full bg-white`} />En línea</span>
                Para conjuntos residenciales en Colombia
              </p>
              <h1 className="mt-7 text-[clamp(2.6rem,6.4vw,5.2rem)] leading-[1.02] font-medium tracking-[-0.045em] text-slate-950">
                {headline.map((line, lineIndex) => <span key={lineIndex} className="block">{line.map(({ word, delay }) => { const accent = word === "conectado."; return <span key={word} className={`${styles.word} ${accent ? `${styles.serif} ${serif.className} pr-1` : ""}`} style={{ animationDelay: `${delay}s` }}>{word}{" "}</span>; })}</span>)}
              </h1>
              <p className={`${styles.rise} ${styles.delay3} mt-7 max-w-[30rem] text-[17px] leading-relaxed text-slate-600`}>ResiQ reúne a la administración, los residentes y la portería de tu conjunto en un solo lugar: la cartera clara, cada solicitud con seguimiento y cada novedad a tiempo.</p>
              <div className={`${styles.rise} ${styles.delay4} mt-9 flex flex-wrap items-center gap-6`}>
                <a href="#tu-dia" className={styles.textLink}>Ver cómo se vive<ArrowDown size={16} className="text-primary" aria-hidden="true" /></a>
              </div>
              <p className={`${styles.rise} ${styles.delay5} mt-8 flex items-center gap-2 text-sm text-slate-500`}><ShieldCheck size={17} className="text-primary" aria-hidden="true" />Acceso por invitación de la administración de tu conjunto.</p>
            </div>
            <div className={`${styles.rise} ${styles.delay2} relative mx-auto w-full max-w-xl`}>
              <Image src="/images/conjunto-resiq.webp" alt="Conjunto residencial con tres torres, piscina y zonas verdes, junto a íconos de paquetes, reservas y pagos al día" width={1402} height={1122} priority sizes="(min-width: 1024px) 560px, 100vw" className={`${styles.heroImage} h-auto w-full`} />
            </div>
          </div>

          {/* Franja de módulos que se desplaza. */}
          <div className={`${styles.rise} ${styles.delay5} mx-auto max-w-6xl px-6 pb-16 sm:px-10`}>
            <p className="mb-4 text-center text-[11px] font-semibold tracking-[0.25em] text-slate-500 uppercase">Todo lo de tu conjunto, en un solo lugar</p>
            <div className={styles.marquee} aria-hidden="true">
              <div className={styles.marqueeTrack}>{[...modules, ...modules].map(({ icon: Icon, title }, index) => <span key={index} className="mx-6 inline-flex shrink-0 items-center gap-2 text-[15px] font-medium text-slate-500"><Icon size={17} className="text-primary/70" />{title}</span>)}</div>
            </div>
          </div>
        </section>

        {/* Así se ve tu día: maqueta del celular con avisos que llegan. */}
        <section id="tu-dia" className="scroll-mt-24 bg-white py-20 sm:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 sm:px-10 lg:grid-cols-2">
            <Reveal className="order-2 mx-auto w-full max-w-[340px] lg:order-1">
              <div className={styles.phone}>
                <div className={`${styles.phoneScreen} px-4 pt-5 pb-6`}>
                  <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-500"><span>9:45</span><span className="h-1.5 w-14 rounded-full bg-slate-900/80" /><span>ResiQ</span></div>
                  <p className="mt-5 px-1 text-xs font-medium text-slate-500">Buenos días</p>
                  <p className="px-1 text-lg font-semibold tracking-tight text-slate-950">Tu conjunto hoy</p>
                  <ul className="mt-4 grid gap-2.5">{notices.map(({ icon: Icon, tone, title, detail, time }) => <li key={title} className={`${styles.notice} flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm`}>
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={18} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-slate-900">{title}</span><span className="block truncate text-xs text-slate-500">{detail}</span></span>
                    <span className="text-[11px] text-slate-400">{time}</span>
                  </li>)}</ul>
                </div>
              </div>
            </Reveal>
            <Reveal className="order-1 lg:order-2">
              <p className="text-[11px] font-semibold tracking-[0.25em] text-primary uppercase">Tu día en el conjunto</p>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3.2rem)] leading-[1.06] font-medium tracking-[-0.035em] text-slate-950">Todo lo que pasa en tu conjunto, <span className={`${styles.serif} ${serif.className}`}>en tu bolsillo.</span></h2>
              <p className="mt-5 max-w-[30rem] text-[17px] leading-relaxed text-slate-600">Cuando portería recibe un paquete, cuando registran tu pago o cuando aprueban tu reserva, te enteras al momento. Sin llamadas, sin papeles y sin filas en la administración.</p>
              <ul className="mt-8 grid gap-3 text-[15px] text-slate-700">{["Tu estado de cuenta siempre claro, con tus comprobantes", "Avisos de paquetes, visitas y reservas al instante", "Comunicados y asambleas de tu comunidad"].map((point) => <li key={point} className="flex items-start gap-3"><CheckCircle2 size={19} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{point}</li>)}</ul>
            </Reveal>
          </div>
        </section>

        <section id="modulos" className="scroll-mt-24 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <Reveal className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.25em] text-primary uppercase">Todo en un lugar</p>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3.2rem)] leading-[1.06] font-medium tracking-[-0.035em] text-slate-950">Menos trámites. <span className={`${styles.serif} ${serif.className}`}>Más comunidad.</span></h2>
              <p className="mt-4 text-[17px] text-slate-600">Cada módulo está pensado para el día a día de un conjunto residencial.</p>
            </Reveal>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map(({ icon: Icon, title, description }, index) => <Reveal as="li" key={title} delay={(index % 4) as 0 | 1 | 2 | 3} className="h-full">
                <article className={`${liftCard.card} h-full rounded-3xl p-6`}>
                  <span className={`${liftCard.icon} size-12`}><Icon size={22} aria-hidden="true" /></span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              </Reveal>)}
            </ul>
          </div>
        </section>

        <section id="perfiles" className="scroll-mt-24 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <Reveal className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.25em] text-primary uppercase">Para cada persona del conjunto</p>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3.2rem)] leading-[1.06] font-medium tracking-[-0.035em] text-slate-950">Cada quien ve <span className={`${styles.serif} ${serif.className}`}>lo que necesita.</span></h2>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {profiles.map(({ icon: Icon, title, points }, index) => <Reveal key={title} delay={index as 0 | 1 | 2}>
                <article className={`${liftCard.card} h-full rounded-3xl p-7`}>
                  <span className={`${liftCard.icon} size-12`}><Icon size={22} aria-hidden="true" /></span>
                  <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                  <ul className="mt-4 grid gap-3 text-sm text-slate-600">{points.map((point) => <li key={point} className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{point}</li>)}</ul>
                </article>
              </Reveal>)}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-24 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-[11px] font-semibold tracking-[0.25em] text-primary uppercase">Cómo funciona</p>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3.2rem)] leading-[1.06] font-medium tracking-[-0.035em] text-slate-950">Empezar es <span className={`${styles.serif} ${serif.className}`}>muy sencillo.</span></h2>
            </Reveal>
            <ol className="relative mt-14 grid gap-10 md:grid-cols-3">
              <span aria-hidden="true" className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10 md:block" />
              {steps.map(({ icon: Icon, title, description }, index) => <Reveal as="li" key={title} delay={index as 0 | 1 | 2} className="relative text-center">
                <span className="relative mx-auto flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30"><Icon size={24} aria-hidden="true" /></span>
                <p className={`${styles.stepIndex} mt-5 text-[11px] font-semibold text-primary`}>0{index + 1}</p>
                <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">{description}</p>
              </Reveal>)}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:px-10">
          <span className="flex items-center gap-2 font-semibold text-slate-900"><span className="flex size-8 items-center justify-center rounded-full bg-primary text-white"><Building2 size={16} aria-hidden="true" /></span>ResiQ</span>
          <span>Una comunidad mejor conectada · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
