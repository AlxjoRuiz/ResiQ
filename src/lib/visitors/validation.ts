const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

export function validVisitDocument(value: string) {
  return value === "" || /^[0-9]{2,6}$/.test(value);
}

/** Resolve a wall-clock time in the property's zone, never the server's zone. */
export function visitTimeToIso(value: string, timeZone: string): string | null {
  if (!localDateTimePattern.test(value)) return null;
  const wallTime = Date.parse(`${value}Z`);
  if (!Number.isFinite(wallTime)) return null;
  const expected = value.length === 16 ? `${value}:00` : value;
  if (new Date(wallTime).toISOString().slice(0, 19) !== expected) return null;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    const localValue = (instant: number) => {
      const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
    };
    const offsets = new Set<number>();
    for (const hours of [-36, -12, 0, 12, 36]) {
      const instant = wallTime + hours * 3_600_000;
      offsets.add(Date.parse(`${localValue(instant)}Z`) - instant);
    }
    const matches = [...offsets].map((offset) => wallTime - offset)
      .filter((instant) => localValue(instant) === expected);
    // A nonexistent or ambiguous DST time needs another explicit selection.
    return matches.length === 1 ? new Date(matches[0]).toISOString() : null;
  } catch {
    return null;
  }
}

export function visitWindowError(startIso: string, endIso: string, now = Date.now()): string | null {
  const start = Date.parse(startIso), end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "Selecciona fechas y horas válidas.";
  if (end <= start) return "El fin de la visita debe ser posterior al inicio.";
  if (end - start > 86_400_000) return "La visita puede durar máximo 24 horas.";
  if (start < now - 900_000) return "El inicio de la visita no puede estar más de 15 minutos en el pasado. Actualiza el horario.";
  return null;
}

export function visitErrorMessage(message?: string) {
  if (message?.includes("not_authorized")) return "No tienes permiso para realizar esta acción.";
  if (message?.includes("authorization_evidence_required")) return "Indica cómo se confirmó la autorización con el residente.";
  if (message?.includes("invalid_host")) return "El anfitrión ya no está vinculado a ese apartamento.";
  if (message?.includes("invalid_unit")) return "Selecciona un apartamento activo de tu conjunto.";
  if (message?.includes("outside_authorized_window")) return "El ingreso está fuera de la ventana autorizada.";
  if (message?.includes("invalid_document")) return "Escribe entre 2 y 6 dígitos del documento, o deja el campo vacío. Se permiten dígitos repetidos.";
  if (message?.includes("invalid_window")) return "Revisa el horario: el fin debe ser posterior al inicio, la duración máxima es 24 horas y el inicio no puede estar más de 15 minutos en el pasado.";
  if (message?.includes("service_required")) return "Especifica el tipo de servicio de mantenimiento.";
  if (message?.includes("invalid_transition")) return "La visita ya no admite ese cambio.";
  return "No pudimos guardar el cambio. Revisa los datos e inténtalo nuevamente.";
}
