const supported = new Set(["image/png", "image/jpeg", "image/webp"]);
/** Decode a user-selected local file; never fetch a logo from a third party. */
export async function prepareCompanyImage(file: File): Promise<string> {
  if (!supported.has(file.type))
    throw new Error(
      "Kies een PNG-, JPEG- of WebP-afbeelding. SVG wordt niet ondersteund.",
    );
  if (file.size > 3 * 1024 * 1024)
    throw new Error("Deze afbeelding is te groot. Gebruik maximaal 3 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode().catch(() => {
      throw new Error(
        "De afbeelding kon niet worden gelezen. Kies een ander bestand.",
      );
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 16000000
    )
      throw new Error("Gebruik een afbeelding van maximaal 16 megapixels.");
    const scale = Math.min(
      192 / image.naturalWidth,
      192 / image.naturalHeight,
      1,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Afbeeldingen verwerken is niet beschikbaar in deze browser.",
      );
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/webp", 0.86);
    if (result.length > 180000)
      throw new Error(
        "De afbeelding blijft te groot. Kies een eenvoudiger logo.",
      );
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
