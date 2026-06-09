export type SepaEpcRequest = {
  name: string;
  iban: string;
  bic?: string | null;
  amountEur: number;
  remittance?: string | null;
};

function normalizeIban(raw: string) {
  return raw.replace(/\s+/g, '').toUpperCase();
}

function normalizeBic(raw: string) {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isProbablyIban(raw: string) {
  const iban = normalizeIban(raw);
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban);
}

export function isProbablyBic(raw: string) {
  const bic = normalizeBic(raw);
  return /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic);
}

function formatAmountEur(amount: number) {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return safe.toFixed(2);
}

/**
 * Build EPC QR payload (SEPA Credit Transfer) string (a.k.a. "GiroCode").
 * This payload can be converted to a QR code by a payment app / generator.
 */
export function buildSepaEpcPayload(req: SepaEpcRequest) {
  const name = req.name.trim().slice(0, 70);
  const iban = normalizeIban(req.iban);
  const bic = req.bic ? normalizeBic(req.bic) : '';
  const remittance = (req.remittance ?? '').trim().slice(0, 140);

  const amount = formatAmountEur(req.amountEur);

  return [
    'BCD',
    '001',
    '1',
    'SCT',
    bic,
    name,
    iban,
    `EUR${amount}`,
    '',
    '',
    remittance,
  ].join('\n');
}

