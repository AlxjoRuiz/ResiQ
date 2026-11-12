"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { caseStateLabels, formatCop, formatShort, severities, type CaseState, type Debtor } from "@/lib/legal/report";

// Tabla de apartamentos en mora (fase 1, 12/11/2026): buscador, filtros por torre, gravedad, estado y valor, y orden
// por columnas. En pantalla se filtra; al imprimir o guardar el PDF sale la tabla completa.
type SortKey = "unit" | "owner" | "overdue" | "total" | "days" | "last_payment_on";
const amountRanges = [
  { value: "", label: "Cualquier valor" },
  { value: "0-500000", label: "Hasta $ 500.000" },
  { value: "500000-2000000", label: "$ 500.000 a $ 2.000.000" },
  { value: "2000000-", label: "Más de $ 2.000.000" },
];
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
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("");
  const [severity, setSeverity] = useState("");
  const [state, setState] = useState("");
  const [amount, setAmount] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "days", desc: true });
  const onSort = (key: SortKey) => setSort((current) => current.key === key ? { key, desc: !current.desc } : { key, desc: key !== "unit" && key !== "owner" });

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    const [min, max] = amount ? amount.split("-").map((value) => value ? Number(value) : null) : [null, null];
    const filtered = debtors.filter((debtor) => (!text || `${debtor.building} ${debtor.code} ${debtor.owner_name ?? ""}`.toLowerCase().includes(text))
      && (!building || debtor.building === building) && (!severity || debtor.severity.key === severity) && (!state || debtor.state === state)
      && (min === null || debtor.overdue > min) && (max === null || debtor.overdue <= max));
    const value = (debtor: Debtor): string | number => sort.key === "unit" ? `${debtor.building} ${debtor.code}` : sort.key === "owner" ? debtor.owner_name ?? "" : sort.key === "last_payment_on" ? debtor.last_payment_on ?? "" : debtor[sort.key];
    return [...filtered].sort((a, b) => { const x = value(a), y = value(b); const result = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es", { numeric: true }); return sort.desc ? -result : result; });
  }, [debtors, query, building, severity, state, amount, sort]);
  const clear = () => { setQuery(""); setBuilding(""); setSeverity(""); setState(""); setAmount(""); };
  const filtering = Boolean(query || building || severity || state || amount);

  const head = <tr className="bg-primary text-xs text-white">
    <Header label="Apto." sortKey="unit" sort={sort} onSort={onSort} /><Header label="Torre" sort={sort} onSort={onSort} /><Header label="Propietario o residente" sortKey="owner" sort={sort} onSort={onSort} />
    <Header label="Capital vencido" sortKey="overdue" sort={sort} onSort={onSort} align="right" /><Header label="Total adeudado" sortKey="total" sort={sort} onSort={onSort} align="right" />
    <Header label="Meses en mora" sortKey="days" sort={sort} onSort={onSort} align="center" /><Header label="Último pago" sortKey="last_payment_on" sort={sort} onSort={onSort} />
    <Header label="Gravedad" sort={sort} onSort={onSort} /><Header label="Estado del caso" sort={sort} onSort={onSort} />
  </tr>;

  return <div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)] print:hidden">
      <label className="relative"><span className="sr-only">Buscar apartamento o propietario</span><Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar apartamento o propietario" className={`${field} w-full pl-9`} /></label>
      <label><span className="sr-only">Torre</span><select value={building} onChange={(event) => setBuilding(event.target.value)} className={`${field} w-full`}><option value="">Todas las torres</option>{buildings.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label><span className="sr-only">Rango de mora</span><select value={severity} onChange={(event) => setSeverity(event.target.value)} className={`${field} w-full`}><option value="">Cualquier mora</option>{severities.map((item) => <option key={item.key} value={item.key}>{item.label} ({item.range})</option>)}</select></label>
      <label><span className="sr-only">Estado del caso</span><select value={state} onChange={(event) => setState(event.target.value)} className={`${field} w-full`}><option value="">Cualquier estado</option>{(Object.keys(caseStateLabels) as CaseState[]).map((key) => <option key={key} value={key}>{caseStateLabels[key]}</option>)}</select></label>
      <label><span className="sr-only">Valor adeudado</span><select value={amount} onChange={(event) => setAmount(event.target.value)} className={`${field} w-full`}>{amountRanges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
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
