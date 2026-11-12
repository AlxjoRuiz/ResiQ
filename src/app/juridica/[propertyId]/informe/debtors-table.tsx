"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { caseStateLabels, formatCop, formatShort, type CaseState, type Debtor } from "@/lib/legal/report";

// Tabla de apartamentos en mora (12/11/2026): filtros por torre y estado del caso, y orden por columnas (el buscador
// y los filtros de mora y valor se quitaron a pedido de Alejandro). En pantalla se filtra; en el PDF sale completa.
type SortKey = "unit" | "owner" | "overdue" | "total" | "days" | "last_payment_on";
const field = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function Row({ debtor, propertyId }: { debtor: Debtor; propertyId: string }) {
  return <tr className="border-b border-slate-100 last:border-0 break-inside-avoid">
    <td className="px-3 py-2.5 font-medium"><Link href={`/juridica/${propertyId}/${debtor.unit_id}`} className="hover:text-primary">{debtor.code}</Link></td>
    <td className="px-3 py-2.5 text-slate-600">{debtor.building}</td>
    <td className="px-3 py-2.5 text-slate-700">{debtor.owner_name ?? "—"}</td>
    <td className="px-3 py-2.5 text-right font-medium text-urgent">{formatCop(debtor.overdue)}</td>
    <td className="px-3 py-2.5 text-right">{formatCop(debtor.total)}</td>
    <td className="px-3 py-2.5 text-center">{debtor.months}</td>
    <td className="px-3 py-2.5 text-slate-600">{formatShort(debtor.last_payment_on)}</td>
    <td className="px-3 py-2.5"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${debtor.severity.tone}`}>{debtor.severity.label} · {debtor.days} d</span></td>
    <td className="px-3 py-2.5 text-xs text-slate-700">{caseStateLabels[debtor.state]}</td>
  </tr>;
}

function Header({ label, sortKey, sort, onSort, align = "left" }: { label: string; sortKey?: SortKey; sort: { key: SortKey; desc: boolean }; onSort: (key: SortKey) => void; align?: "left" | "right" | "center" }) {
  const active = sortKey && sort.key === sortKey;
  const Arrow = sort.desc ? ArrowDown : ArrowUp;
  return <th scope="col" aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined} className={`px-3 py-2 font-medium ${{ left: "text-left", right: "text-right", center: "text-center" }[align]}`}>
    {sortKey ? <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:underline print:pointer-events-none">{label}{active && <Arrow size={13} aria-hidden="true" />}</button> : label}
  </th>;
}

export function DebtorsTable({ debtors, buildings, propertyId }: { debtors: Debtor[]; buildings: string[]; propertyId: string }) {
  const [building, setBuilding] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "days", desc: true });
  const onSort = (key: SortKey) => setSort((current) => current.key === key ? { key, desc: !current.desc } : { key, desc: key !== "unit" && key !== "owner" });

  const rows = useMemo(() => {
    const filtered = debtors.filter((debtor) => (!building || debtor.building === building) && (!state || debtor.state === state));
    const value = (debtor: Debtor): string | number => sort.key === "unit" ? `${debtor.building} ${debtor.code}` : sort.key === "owner" ? debtor.owner_name ?? "" : sort.key === "last_payment_on" ? debtor.last_payment_on ?? "" : debtor[sort.key];
    return [...filtered].sort((a, b) => { const x = value(a), y = value(b); const result = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es", { numeric: true }); return sort.desc ? -result : result; });
  }, [debtors, building, state, sort]);
  const clear = () => { setBuilding(""); setState(""); };
  const filtering = Boolean(building || state);

  const head = <tr className="bg-primary text-xs text-white">
    <Header label="Apto." sortKey="unit" sort={sort} onSort={onSort} /><Header label="Torre" sort={sort} onSort={onSort} /><Header label="Propietario o residente" sortKey="owner" sort={sort} onSort={onSort} />
    <Header label="Capital vencido" sortKey="overdue" sort={sort} onSort={onSort} align="right" /><Header label="Total adeudado" sortKey="total" sort={sort} onSort={onSort} align="right" />
    <Header label="Meses en mora" sortKey="days" sort={sort} onSort={onSort} align="center" /><Header label="Último pago" sortKey="last_payment_on" sort={sort} onSort={onSort} />
    <Header label="Gravedad" sort={sort} onSort={onSort} /><Header label="Estado del caso" sort={sort} onSort={onSort} />
  </tr>;

  return <div>
    <div className="mt-4 grid gap-2 sm:max-w-xl sm:grid-cols-2 print:hidden">
      <label><span className="sr-only">Torre</span><select value={building} onChange={(event) => setBuilding(event.target.value)} className={`${field} w-full`}><option value="">Todas las torres</option>{buildings.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label><span className="sr-only">Estado del caso</span><select value={state} onChange={(event) => setState(event.target.value)} className={`${field} w-full`}><option value="">Cualquier estado</option>{(Object.keys(caseStateLabels) as CaseState[]).map((key) => <option key={key} value={key}>{caseStateLabels[key]}</option>)}</select></label>
    </div>
    <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 print:hidden" role="status">Mostrando {rows.length} de {debtors.length} apartamentos en mora{filtering && <button type="button" onClick={clear} className="font-medium text-primary hover:underline">Quitar filtros</button>}</p>

    {/* En pantalla: la tabla filtrada. */}
    <div className="mt-3 overflow-x-auto print:hidden"><table className="w-full min-w-[980px] text-left text-sm"><thead>{head}</thead>
      <tbody>{rows.map((debtor) => <Row key={debtor.unit_id} debtor={debtor} propertyId={propertyId} />)}</tbody></table>
      {!rows.length && <p className="py-6 text-center text-sm text-slate-500">Ningún apartamento coincide con los filtros.</p>}
    </div>
    {/* Al imprimir o guardar el PDF: todos los apartamentos en mora, de mayor a menor antigüedad. */}
    <table className="hidden w-full text-left text-[11px] print:table"><thead>{head}</thead>
      <tbody>{debtors.map((debtor) => <Row key={debtor.unit_id} debtor={debtor} propertyId={propertyId} />)}</tbody></table>
  </div>;
}
