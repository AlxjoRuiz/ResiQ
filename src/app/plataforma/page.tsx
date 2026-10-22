import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlatformOverview } from "@/components/dashboard/platform-overview";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export default async function PlatformPage() {
  const { supabase } = await requirePlatformAdmin();
  return <main className="mx-auto min-h-screen max-w-7xl px-5 py-7 sm:px-10"><header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6"><div><p className="text-xs font-semibold tracking-wider text-primary uppercase">ResiQ SaaS</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Panel de plataforma</h1><p className="mt-2 text-sm text-muted-foreground">Métricas y accesos globales sin exposición de información privada de residentes.</p></div><Button asChild variant="outline" size="sm"><Link href="/panel">Comunidades</Link></Button></header><PlatformOverview supabase={supabase} /></main>;
}
