/** Validación diferida: la página pública funciona sin credenciales. */
export function getSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Configura las variables públicas de Supabase en .env.local antes de usar la conexión.");
  }

  const parsed = new URL(url);
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:")) {
    throw new Error("Supabase requiere una URL HTTPS, excepto en desarrollo local.");
  }
  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Usa la clave publishable de Supabase; no claves secretas o service_role.");
  }

  return { url, publishableKey };
}
