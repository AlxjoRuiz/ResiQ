"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6"><h1 className="text-3xl font-semibold">No pudimos cargar la página.</h1><p className="text-muted-foreground">Inténtalo de nuevo en unos momentos.</p><Button onClick={reset}>Reintentar</Button></main>;
}
