import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6"><p className="text-sm text-muted-foreground">404</p><h1 className="text-3xl font-semibold">No encontramos esta página.</h1><p className="text-muted-foreground">Revisa la dirección o vuelve al inicio.</p><Button asChild><Link href="/">Volver al inicio</Link></Button></main>;
}
