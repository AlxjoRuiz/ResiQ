// Precio único de ResiQ por conjunto (decisión de Alejandro, 26/10/2026): mensual o anual (12 meses).
export const PLAN_MONTHLY_COP = 400_000;
export const PLAN_ANNUAL_COP = PLAN_MONTHLY_COP * 12;
export const planLabels = { monthly: "Mensual", annual: "Anual" } as const;
export type BillingCycle = keyof typeof planLabels;
