export function conciergeFullName(names: string, surnames: string) {
  return `${names} ${surnames}`.replace(/\s+/gu, " ").trim();
}

/** Name and surname fields may contain multiple words; the username uses the first of each. */
export function conciergeUsername(firstName: string, firstSurname: string, documentNumber: string): string | null {
  const normalizePart = (value: string) => value.trim().split(/\s+/u)[0]
    .normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");
  const name = normalizePart(firstName);
  const surname = normalizePart(firstSurname);
  const document = documentNumber.trim();
  if (!name || !surname || !/^\d{5,20}$/u.test(document)) return null;
  return `${name}${surname}${document.slice(-2)}`;
}

export function maskDocument(documentNumber: string) {
  const digits = documentNumber.replace(/\D/gu, "");
  return `${"•".repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}`;
}
