"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./home.module.css";

// Hace aparecer su contenido cuando entra en pantalla al bajar por la portada (10/11/2026).
// Sin JavaScript o con «reducir movimiento», el contenido se ve igual desde el principio.
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: 0 | 1 | 2 | 3; as?: "div" | "li" | "section" }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") { element.dataset.visible = "true"; return; }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { (entry.target as HTMLElement).dataset.visible = "true"; observer.unobserve(entry.target); }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const delayClass = delay ? ["", "delay-[90ms]", "delay-[180ms]", "delay-[270ms]"][delay] : "";
  return <Tag ref={(node: HTMLElement | null) => { ref.current = node; }} className={`${styles.reveal} ${delayClass} ${className}`}>{children}</Tag>;
}
