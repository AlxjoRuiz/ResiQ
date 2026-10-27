import { COLOMBIA_TIME_ZONE, dateInputValue } from "@/lib/time-zone";

// Datos personales comunes de portería y auxiliares de administración.
export type Vehicle = { type: string; brand: string; model: string; plate: string };

export function normalizePhone(raw: string) {
  const clean = raw.replace(/[\s()-]/gu, "");
  const phone = /^3\d{9}$/u.test(clean) ? `+57${clean}` : clean;
  return /^\+[1-9]\d{7,14}$/u.test(phone) ? phone : null;
}
export function ageOn(date: string, today = new Date()) {
  const birth = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== date) return null;
  const localToday = dateInputValue(today, COLOMBIA_TIME_ZONE);
  const year = Number(localToday.slice(0, 4)) - Number(date.slice(0, 4));
  return year - (localToday.slice(5) < date.slice(5) ? 1 : 0);
}
export function parseVehicles(raw: string): Vehicle[] | null {
  try {
    const vehicles: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(vehicles) || vehicles.length > 10) return null;
    const parsed: Vehicle[] = [];
    for (const item of vehicles) {
      if (!item || typeof item !== "object") return null;
      const vehicle = item as Record<string, unknown>;
      const fields = ["type", "brand", "model", "plate"] as const;
      if (fields.some((key) => typeof vehicle[key] !== "string" || !(vehicle[key] as string).trim() || (vehicle[key] as string).length > 60)) return null;
      parsed.push(Object.fromEntries(fields.map((key) => [key, (vehicle[key] as string).trim()])) as Vehicle);
    }
    return parsed;
  } catch { return null; }
}
