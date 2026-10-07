const redirectBase = "https://resiq.invalid";

/** Returns a canonical app path, never a URL to a different origin. */
export function safeNext(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/panel";
  try {
    const target = new URL(value, redirectBase);
    if (target.origin !== redirectBase) return "/panel";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/panel";
  }
}
