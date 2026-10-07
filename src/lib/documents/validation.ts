export function isValidDocument(bytes: Uint8Array, mimeType: string, expectedSize: number): boolean {
  const signatures: Record<string, number[]> = {
    "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  };
  return bytes.length === expectedSize && bytes.length > 0 && bytes.length <= 10 * 1024 * 1024
    && (signatures[mimeType]?.every((value, index) => bytes[index] === value) ?? false);
}
