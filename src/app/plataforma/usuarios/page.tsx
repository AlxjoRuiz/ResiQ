import { PlatformPage } from "@/components/dashboard/platform-page";
import { UsersView, type UsersFilters } from "../views/users-view";

// Usuarios de los conjuntos de producción; los de prueba están en Pruebas ResiQ (31/10/2026).
export default async function PlatformUsersPage({ searchParams }: { searchParams: Promise<UsersFilters> }) {
  return <PlatformPage title="Usuarios" description="Toca un conjunto para ver sus usuarios: activos, con invitación enviada o vencida.">
    <UsersView params={await searchParams} basePath="/plataforma/usuarios" />
  </PlatformPage>;
}
