"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type CensusListRow = {
  id: string;
  tower: string;
  apartment: string;
  floor: string | null;
  fullName: string | null;
  userType: string | null;
  phone: string | null;
  email: string | null;
};

export function CensusList({ propertyId, rows }: { propertyId: string; rows: CensusListRow[] }) {
  const [search, setSearch] = useState("");
  const [tower, setTower] = useState("");
  const [userType, setUserType] = useState("");
  const towers = useMemo(() => [...new Set(rows.map((row) => row.tower))], [rows]);
  const types = useMemo(() => [...new Set(rows.map((row) => row.userType).filter((value): value is string => Boolean(value)))], [rows]);
  const visible = rows.filter((row) => (!tower || row.tower === tower) && (!userType || row.userType === userType)
    && (!search || `${row.apartment} ${row.fullName ?? ""} ${row.email ?? ""}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))));
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]"><label className="grid gap-1 text-sm">Buscar apartamento o residente<input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 min-w-0 rounded-lg border bg-white px-3" placeholder="Apartamento, nombre o correo" /></label><label className="grid gap-1 text-sm">Torre<select value={tower} onChange={(event) => setTower(event.target.value)} className="h-11 min-w-0 rounded-lg border bg-white px-3"><option value="">Todas</option>{towers.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-1 text-sm">Tipo de usuario<select value={userType} onChange={(event) => setUserType(event.target.value)} className="h-11 min-w-0 rounded-lg border bg-white px-3"><option value="">Todos</option>{types.map((item) => <option key={item}>{item}</option>)}</select></label></div>
    <p className="text-sm text-muted-foreground">{visible.length} respuestas</p>
    <div className="overflow-x-auto rounded-xl border"><table className="min-w-[48rem] w-full text-left text-sm"><thead className="bg-secondary"><tr><th className="p-3">Torre</th><th className="p-3">Piso</th><th className="p-3">Apto</th><th className="p-3">Residente</th><th className="p-3">Tipo</th><th className="p-3">Teléfono</th><th className="p-3">Correo</th><th className="p-3">Acción</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id} className="border-t"><td className="p-3">{row.tower}</td><td className="p-3">{row.floor || "Sin información"}</td><td className="p-3">{row.apartment}</td><td className="p-3">{row.fullName || "Sin información"}</td><td className="p-3">{row.userType || "Sin información"}</td><td className="p-3">{row.phone || "Sin información"}</td><td className="break-all p-3">{row.email || "Sin información"}</td><td className="p-3"><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/panel/propiedades/${propertyId}/censo/${row.id}`}>Ver detalles →</Link></td></tr>)}</tbody></table>{visible.length === 0 && <p className="p-5 text-sm text-muted-foreground">No hay respuestas para estos filtros.</p>}</div>
  </div>;
}
