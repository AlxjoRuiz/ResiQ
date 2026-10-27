import { createClient } from "@/lib/supabase/server";
import styles from "./seasonal.module.css";

// Decoración de temporada: figuras cayendo por el fondo blanco a los lados de todas las páginas del
// panel y la plataforma (se monta en sus layouts). Solo visual (aria-hidden, sin clics); posiciones
// fijas para que el servidor y el navegador muestren lo mismo.
const themes = {
  christmas: ["🎅", "🦌", "❄️", "🎄", "❄️", "🦌", "❄️", "🎄"],
  halloween: ["🎃", "🦇", "👻", "🕸️", "🎃", "🦇", "🍬", "👻"],
} as const;
type Theme = keyof typeof themes;
const positions = Array.from({ length: 48 }, (_, index) => ({
  left: (index * 37) % 100,
  duration: 14 + (index * 7) % 12,
  delay: -((index * 5) % 20),
  restTop: (index * 23) % 95,
}));
// Navidad: además, Papá Noel en su trineo con renos cruzando el cielo una y otra vez.
const sleighs = [{ top: 10, duration: 26, delay: 0 }, { top: 46, duration: 32, delay: -16 }];
// Halloween: además, murciélagos que cruzan la pantalla volando de lado a lado.
const bats = Array.from({ length: 7 }, (_, index) => ({
  top: 8 + (index * 13) % 80,
  duration: 16 + (index * 5) % 10,
  delay: -((index * 7) % 22),
  reverse: index % 2 === 1,
}));

// El tema y si está activa se eligen para todos en Plataforma → Configuración (platform_settings).
export async function SeasonalDecor() {
  const supabase = await createClient();
  const { data: theme } = await supabase.rpc("get_seasonal_theme");
  if (typeof theme !== "string" || !(theme in themes)) return null;
  const figures = themes[theme as Theme];
  return <div aria-hidden="true" className={styles.layer}>
    {positions.map((item, index) => <span key={index} className={styles.item} style={{ left: `${item.left}%`, animationDuration: `${item.duration}s`, animationDelay: `${item.delay}s`, ["--rest-top" as string]: `${item.restTop}vh` }}>{figures[index % figures.length]}</span>)}
    {theme === "christmas" && sleighs.map((sleigh, index) => <span key={`sleigh-${index}`} className={styles.sleigh} style={{ top: `${sleigh.top}vh`, animationDuration: `${sleigh.duration}s`, animationDelay: `${sleigh.delay}s` }}>🦌🦌🛷🎅</span>)}
    {theme === "halloween" && bats.map((bat, index) => <span key={`bat-${index}`} className={`${styles.bat} ${bat.reverse ? styles.batReverse : ""}`} style={{ top: `${bat.top}vh`, animationDuration: `${bat.duration}s`, animationDelay: `${bat.delay}s` }}>🦇</span>)}
  </div>;
}
