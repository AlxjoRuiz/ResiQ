import { redirect } from "next/navigation";

// «Administradores» se repartió el 30/10/2026: los administradores de cada conjunto están en su ficha
// (Conjuntos) y el equipo de mantenimiento en «Equipos ResiQ». La dirección vieja lleva a Conjuntos.
export default function PlatformAdministratorsPage() {
  redirect("/plataforma/propiedades");
}
