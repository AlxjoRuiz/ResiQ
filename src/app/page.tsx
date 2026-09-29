import { ArrowDown, Building2, CalendarDays, MessageSquareText, Package, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/config/site";

const features = [
  { icon: MessageSquareText, title: "Una comunicación más cercana", description: "Solicitudes, respuestas y novedades de tu comunidad en un mismo lugar." },
  { icon: Package, title: "Tu día a día, más sencillo", description: "Paquetes y visitas organizados para residentes y portería." },
  { icon: CalendarDays, title: "Espacios para compartir", description: "Consulta las zonas comunes y organiza tus próximas reservas." },
];

export default function HomePage() {
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:bg-white focus:p-4">Saltar al contenido</a>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <span className="flex items-center gap-3 text-sm font-semibold sm:text-base"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><Building2 size={22} aria-hidden="true" /></span>{siteConfig.name}</span>
          <Button asChild variant="outline" size="sm"><a href="/login">Ingresar</a></Button>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-6 sm:px-10">
        <section className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-primary uppercase">Tu comunidad, conectada</p>
            <h1 className="max-w-2xl text-4xl leading-[1.12] font-semibold tracking-tight sm:text-6xl">Un mejor lugar<br />para vivir empieza<br /><span className="text-primary">con estar conectados.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">Un espacio compartido para residentes, portería y administración. Más claridad en cada solicitud y más tranquilidad en el día a día.</p>
            <Button asChild className="mt-8"><a href="#comunidad">Conoce el espacio <ArrowDown size={16} aria-hidden="true" /></a></Button>
          </div>
          <Card className="overflow-hidden bg-[#edf4ef]">
            <CardContent className="p-8 sm:p-10">
              <div className="mb-10 flex items-center gap-2 text-xs font-medium text-primary"><span className="size-2 rounded-full bg-primary" />Estamos construyendo tu próximo espacio</div>
              <div aria-hidden="true" className="flex h-44 items-end justify-center gap-3 border-b border-[#b9ccbe] pb-0">
                {[3, 5, 4].map((floors, index) => <div key={index} className="grid min-w-0 flex-1 grid-cols-2 gap-2 rounded-t-lg border border-[#b9ccbe] bg-white/80 p-2 sm:gap-3 sm:p-4">{Array.from({ length: floors * 2 }, (_, i) => <span key={i} className="h-4 w-full rounded-sm bg-[#c4d9cc]" />)}</div>)}
              </div>
              <h2 className="mt-8 text-xl font-semibold">Todo empieza en comunidad.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Estamos preparando la plataforma. El acceso por invitación estará disponible próximamente.</p>
              <div className="mt-6 flex items-center gap-2 text-xs text-primary"><ShieldCheck size={17} aria-hidden="true" />Acceso previsto para miembros autorizados</div>
            </CardContent>
          </Card>
        </section>
        <section id="comunidad" className="scroll-mt-8 border-t py-12 sm:py-16">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Lo que viene</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Menos trámites. Más comunidad.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">{features.map(({ icon: Icon, title, description }) => <Card key={title}><CardContent><Icon className="mb-6 text-primary" size={24} aria-hidden="true" /><h3 className="font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p></CardContent></Card>)}</div>
        </section>
      </main>
      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">Propiedad Horizontal · Una comunidad mejor conectada</footer>
    </>
  );
}
