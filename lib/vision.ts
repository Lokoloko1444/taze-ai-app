// Placeholder vision classification using a lightweight heuristic.
// Swap with an ONNX/HF model later.

export type VisionGuess = {
  label: string;
  category: string;
  confidence: number;
  expiryDays: number | null;
};

export async function classifyImage(base64: string): Promise<VisionGuess | null> {
  if (!base64) return null;
  return { label: 'Onbekend product', category: 'Controle nodig', confidence: 0.35, expiryDays: null };
}
