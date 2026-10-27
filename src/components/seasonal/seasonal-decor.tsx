import { createClient } from "@/lib/supabase/server";
import styles from "./seasonal.module.css";

// Decoración de temporada: figuras cayendo por el fondo blanco a los lados de todas las páginas del
// panel y la plataforma (se monta en sus layouts). Solo visual (aria-hidden, sin clics); posiciones
// fijas para que el servidor y el navegador muestren lo mismo.
const themes = {
  christmas: ["🎅", "🦌", "❄️", "🎄", "❄️", "🦌", "❄️", "🎄"],
  halloween: ["🎃", "👻", "🕸️", "🍬", "🎃", "👻", "🕸️", "🎃"],
} as const;
type Theme = keyof typeof themes;
// 20 figuras (antes 48): menos animaciones para equipos con poca memoria (27/10/2026).
const positions = Array.from({ length: 20 }, (_, index) => ({
  left: (index * 37) % 100,
  duration: 14 + (index * 7) % 12,
  delay: -((index * 5) % 20),
  restTop: (index * 23) % 95,
}));
// Navidad: además, Papá Noel en su trineo con renos cruzando el cielo una y otra vez.
const sleighs = [{ top: 10, duration: 26, delay: 0 }, { top: 46, duration: 32, delay: -16 }];
// Halloween: además, murciélagos que cruzan la pantalla volando de lado a lado.
const bats = Array.from({ length: 10 }, (_, index) => ({
  top: 5 + (index * 13) % 85,
  duration: 16 + (index * 5) % 10,
  delay: -((index * 7) % 22),
  reverse: index % 2 === 1,
}));

// Reno mirando a la izquierda; las patas se mueven en pares cruzados (legA / legB) al correr.
function Reindeer({ x, rudolph = false }: { x: number; rudolph?: boolean }) {
  return <g transform={`translate(${x} 0)`}>
    <rect className={styles.legB} x="11" y="34" width="3" height="13" rx="1.5" fill="#6d4321" />
    <rect className={styles.legA} x="31" y="34" width="3" height="13" rx="1.5" fill="#6d4321" />
    <ellipse cx="23" cy="30" rx="16" ry="8" fill="#8b5a2b" />
    <rect className={styles.legA} x="15" y="34" width="3" height="13" rx="1.5" fill="#8b5a2b" />
    <rect className={styles.legB} x="35" y="34" width="3" height="13" rx="1.5" fill="#8b5a2b" />
    <path d="M38 27 L43 23 L41 29 Z" fill="#8b5a2b" />
    <path d="M9 28 L5 17 L12 15 L16 26 Z" fill="#8b5a2b" />
    <ellipse cx="5" cy="15" rx="7" ry="4.5" fill="#8b5a2b" />
    <path d="M7 11 L10 3 M10 3 L7 1 M10 3 L14 1 M11 11 L16 5 L20 3 M16 5 L16 1" stroke="#5c3a1a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    <circle cx="4" cy="13.5" r="1" fill="#111111" />
    <circle cx="-1.5" cy="16" r={rudolph ? 2.2 : 1.4} fill={rudolph ? "#e53935" : "#3e2414"} />
  </g>;
}

// Papá Noel sentado en su trineo, tirado por dos renos con riendas. Va hacia la izquierda.
function SantaSleigh() {
  return <svg viewBox="-4 0 228 64" width="170" height="48" className={styles.sleighArt}>
    <path d="M40 30 L62 30 M84 30 L128 36" stroke="#5c3a1a" strokeWidth="1.4" fill="none" />
    <Reindeer x={0} rudolph />
    <Reindeer x={50} />
    <g transform="translate(124 0)">
      <circle cx="70" cy="24" r="12" fill="#795548" />
      <path d="M64 13 Q70 8 76 13" stroke="#5d4037" strokeWidth="2" fill="none" />
      <ellipse cx="44" cy="28" rx="12" ry="12" fill="#d32f2f" />
      <rect x="32" y="27" width="24" height="3" fill="#212121" />
      <circle cx="38" cy="13" r="6" fill="#f5c6a5" />
      <path d="M32 15 Q38 28 44 15 Q41 19 38 18 Q35 19 32 15 Z" fill="#ffffff" stroke="#d6d6d6" strokeWidth="0.8" />
      <path d="M32 10 Q38 1 48 3 L52 9 Q44 6 44 10 Z" fill="#d32f2f" />
      <rect x="31" y="9" width="14" height="3" rx="1.5" fill="#ffffff" stroke="#d6d6d6" strokeWidth="0.6" />
      <circle cx="52" cy="9" r="2.2" fill="#ffffff" stroke="#d6d6d6" strokeWidth="0.6" />
      <circle cx="35.5" cy="12" r="0.9" fill="#111111" />
      <path d="M6 30 L16 30 L20 40 L74 40 L84 22 L92 22 L82 50 L14 50 Q4 50 6 30 Z" fill="#c62828" />
      <path d="M14 46 L80 46" stroke="#f9a825" strokeWidth="1.6" />
      <path d="M22 50 L22 56 M70 50 L70 56" stroke="#f9a825" strokeWidth="2" />
      <path d="M92 58 L10 58 Q0 58 0 50 Q0 45 5 45" stroke="#f9a825" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  </svg>;
}

// Murciélago negro con las alas por separado para que aleteen (animación en seasonal.module.css).
function BatSilhouette() {
  return <svg viewBox="0 0 64 32" width="34" height="17" className={styles.batBody}>
    <path className={styles.wingLeft} d="M29 14 C22 3 11 3 1 9 C7 11 9 15 11 20 C14 16 18 16 21 20 C23 16 26 16 29 19 Z" />
    <path className={styles.wingRight} d="M35 14 C42 3 53 3 63 9 C57 11 55 15 53 20 C50 16 46 16 43 20 C41 16 38 16 35 19 Z" />
    <path d="M28 10 L29 5 L31 9 L33 9 L35 5 L36 10 C38 13 37 21 32 25 C27 21 26 13 28 10 Z" />
  </svg>;
}

// El tema y si está activa se eligen para todos en Plataforma → Configuración (platform_settings).
export async function SeasonalDecor() {
  const supabase = await createClient();
  const { data: theme } = await supabase.rpc("get_seasonal_theme");
  if (typeof theme !== "string" || !(theme in themes)) return null;
  const figures = themes[theme as Theme];
  return <div aria-hidden="true" className={styles.layer}>
    {positions.map((item, index) => <span key={index} className={styles.item} style={{ left: `${item.left}%`, animationDuration: `${item.duration}s`, animationDelay: `${item.delay}s`, ["--rest-top" as string]: `${item.restTop}vh` }}>{figures[index % figures.length]}</span>)}
    {theme === "christmas" && sleighs.map((sleigh, index) => <span key={`sleigh-${index}`} className={styles.sleigh} style={{ top: `${sleigh.top}vh`, animationDuration: `${sleigh.duration}s`, animationDelay: `${sleigh.delay}s` }}><SantaSleigh /></span>)}
    {theme === "halloween" && bats.map((bat, index) => <span key={`bat-${index}`} className={`${styles.bat} ${bat.reverse ? styles.batReverse : ""}`} style={{ top: `${bat.top}vh`, animationDuration: `${bat.duration}s`, animationDelay: `${bat.delay}s` }}><BatSilhouette /></span>)}
  </div>;
}
