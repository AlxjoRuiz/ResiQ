"use client";

import { useState } from "react";
import { normalizeCensusHeader } from "@/lib/census/parse";

const sections = ["Residente", "Familia", "Vehículos", "Mascotas", "Otros"] as const;
type Section = typeof sections[number];

function sectionFor(header: string): Section {
  const key = normalizeCensusHeader(header);
  if (["torre", "apartamento", "tipo de usuario", "nombre completo", "cedula", "numero de telefono", "correo electronico"].includes(key)) return "Residente";
  if (/personas viven|parentesco|discapacidad|menores/.test(key)) return "Familia";
  if (/vehiculo|placa|parqueadero/.test(key)) return "Vehículos";
  if (/mascota/.test(key)) return "Mascotas";
  return "Otros";
}

export function CensusDetail({ headers, cells }: { headers: string[]; cells: (string | null)[] }) {
  const [active, setActive] = useState<Section>("Residente");
  return <div className="space-y-6">
    <nav aria-label="Secciones del censo" className="flex flex-wrap gap-2">{sections.map((section) => <button key={section} type="button" aria-pressed={active === section} onClick={() => setActive(section)} className={`rounded-full border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active === section ? "border-foreground bg-foreground text-background" : "bg-white hover:bg-secondary"}`}>{section}</button>)}</nav>
    <section aria-label={active}><dl className="divide-y">{headers.map((header, index) => sectionFor(header) === active && <div key={index} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><dt className="font-medium">{header}</dt><dd className="break-words text-muted-foreground">{cells[index] || "Sin información"}</dd></div>)}</dl></section>  </div>;
}
