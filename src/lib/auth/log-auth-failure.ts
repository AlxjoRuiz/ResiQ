import "server-only";

// Registro interno de fallos de acceso (visible en los logs de Vercel). El usuario sigue
// viendo un mensaje genérico. Nunca registra contraseñas, correos ni usuarios: solo el
// método, la etapa y el código de error, para diagnosticar casos como el límite de intentos.
export type AuthFailureStage = "concierge_lookup" | "password" | "concierge_mismatch" | "access" | "oauth_callback" | "signup";

export function logAuthFailure(stage: AuthFailureStage, details: { method: "email" | "username" | "google"; reason?: string; status?: number }) {
  console.warn(JSON.stringify({ event: "auth_failure", stage, ...details }));
}
