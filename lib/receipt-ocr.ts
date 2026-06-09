type OcrInput = {
  imageBase64?: string | null;
  imageUri?: string | null;
};

export async function ocrReceipt(input: OcrInput): Promise<string> {
  const hasImage = Boolean(input.imageBase64 || input.imageUri);
  if (!hasImage) {
    return '';
  }

  return '';
}
