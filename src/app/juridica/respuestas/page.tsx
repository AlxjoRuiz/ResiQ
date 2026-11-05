import { redirect } from "next/navigation";

// Desde el 05/11/2026 las respuestas están dentro de cada conjunto (pestaña Respuestas); esta dirección lleva a los conjuntos.
export default function LegalRepliesPage() {
  redirect("/juridica");
}
