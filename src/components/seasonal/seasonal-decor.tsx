import { SEASONAL_DECOR_ENABLED } from "@/lib/ui/seasonal";
import styles from "./seasonal.module.css";

// Decoración de Navidad: Papá Noel, renos, copos de nieve y árboles cayendo por el fondo blanco a
// los lados de todas las páginas del panel (se monta una vez en src/app/panel/layout.tsx). Solo visual (aria-hidden, sin clics); posiciones fijas para que el
// servidor y el navegador muestren lo mismo.
const figures = ["🎅", "🦌", "❄️", "🎄", "❄️", "🦌", "❄️", "🎄"];
const items = Array.from({ length: 48 }, (_, index) => ({
  figure: figures[index % figures.length],
  left: (index * 37) % 100,
  duration: 14 + (index * 7) % 12,
  delay: -((index * 5) % 20),
  restTop: (index * 23) % 95,
}));

export function SeasonalDecor() {
  if (!SEASONAL_DECOR_ENABLED) return null;
  return <div aria-hidden="true" className={styles.layer}>
    {items.map((item, index) => <span key={index} className={styles.item} style={{ left: `${item.left}%`, animationDuration: `${item.duration}s`, animationDelay: `${item.delay}s`, ["--rest-top" as string]: `${item.restTop}vh` }}>{item.figure}</span>)}
  </div>;
}
