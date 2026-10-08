/** JSON request bodies must be objects before callers access action fields. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_json_object");
  }
  return value as Record<string, unknown>;
}
