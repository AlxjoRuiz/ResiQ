import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type DashboardModule = { title: string; description: string; icon: LucideIcon; href?: string };

export function DashboardModules({ modules }: { modules: DashboardModule[] }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{modules.map(({ title, description, icon: Icon, href }) => {
    const content = <Card className="h-full rounded-[22px] border-0 bg-white shadow-sm transition-colors hover:bg-white/80"><CardContent className="flex h-full flex-col"><div className="flex items-start justify-between gap-4"><span className="flex size-10 items-center justify-center rounded-full bg-[#edf3e9] text-[#4c6746]"><Icon size={20} /></span>{href ? <ArrowRight size={18} className="text-muted-foreground" /> : <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={13} />Próxima etapa</span>}</div><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></CardContent></Card>;
    return href ? <Link key={title} href={href} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link> : <div key={title}>{content}</div>;
  })}</div>;
}

export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>;
}
