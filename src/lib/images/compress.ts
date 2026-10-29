// Reduce una foto en el navegador antes de subirla (28/10/2026): las fotos del celular pesan varios MB
// y Vercel no acepta envíos de más de 4,5 MB. Se redimensiona al lado mayor indicado y se guarda en
// JPEG; las fotos tomadas de lado o de frente conservan su orientación.
export async function compressImage(file: File, maxSide = 1280, quality = 0.8): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No pudimos procesar la foto.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("No pudimos procesar la foto.");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}
