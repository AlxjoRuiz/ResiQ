import { PlatformPage } from "@/components/dashboard/platform-page";
import { PropertiesView } from "../views/properties-view";

// Conjuntos de producción; los de prueba están en Pruebas ResiQ (31/10/2026).
export default function PlatformPropertiesPage() {
  return <PlatformPage title="Conjuntos" description="Crea conjuntos y abre cada uno para ver su administración, usuarios, uso y estado.">
    <PropertiesView />
  </PlatformPage>;
}
