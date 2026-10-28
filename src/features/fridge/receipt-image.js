// Resize camera photos before upload; use the original hash for duplicate protection.
export async function prepareReceiptImage(file) {
  if (!file.size || file.size > 25 * 1024 * 1024 || (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)))
    throw Error("Bitte ein Foto bis 25 MB auswählen.");
  if (!globalThis.crypto?.subtle) throw Error("Öffne Fridgely über die sichere https-Adresse, um Fotos zu scannen.");
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(Error("Dieses Bildformat konnte nicht geöffnet werden. Bitte direkt fotografieren oder ein JPG/PNG auswählen."));
      image.src = url;
    });
    const scale = Math.min(1, 3600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Das Foto konnte nicht vorbereitet werden.");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob;
    for (const quality of [0.9, 0.75, 0.6]) {
      blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 5 * 1024 * 1024) break;
    }
    if (!blob || blob.size > 5 * 1024 * 1024) throw Error("Das Foto ist zu groß. Bitte fotografiere nur den Bon.");
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(Error("Das Foto konnte nicht gelesen werden.")); reader.readAsDataURL(blob);
    });
    return { hash, blob, image: { mimeType: "image/jpeg", data } };
  } finally { URL.revokeObjectURL(url); }
}
