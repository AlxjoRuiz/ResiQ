import { PlatformPage } from "@/components/dashboard/platform-page";
import { TeamsView } from "../views/teams-view";

// Equipos ResiQ de producción; el personal de prueba está en Pruebas ResiQ (31/10/2026).
export default function PlatformTeamsPage() {
  return <PlatformPage title="Equipos ResiQ" description="Tu personal, que no pertenece a ningún conjunto.">
    <TeamsView />
  </PlatformPage>;
}
