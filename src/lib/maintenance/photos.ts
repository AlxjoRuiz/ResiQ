import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Enlaces firmados (10 min) para ver fotos privadas de mantenimiento (asistencia y tareas). Solo se
// llama desde páginas que ya validaron el rol y listaron las fotos con las funciones de la base.
export async function signedPhotoLinks(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((path): path is string => !!path))];
  if (!unique.length) return new Map<string, string>();
  const { data } = await createAdminClient().storage.from("private-documents").createSignedUrls(unique, 600);
  return new Map((data ?? []).filter((link) => link.path && link.signedUrl).map((link) => [link.path as string, link.signedUrl as string]));
}
