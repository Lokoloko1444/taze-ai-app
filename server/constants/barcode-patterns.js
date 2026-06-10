/**
 * Barcode pattern inference rules for product recognition.
 * Maps barcode prefixes to product categories and metadata.
 */

module.exports = {
  BARCODE_PATTERNS: [
    {
      prefix: ['20', '21'],
      name: 'Vers toonbankproduct',
      category: 'Vers',
      expiryDays: 1,
      confidence: 0.72,
      notes: 'Barcodepatroon wijst op een vers of intern geprijsd winkelproduct.',
    },
    {
      prefix: ['87'],
      name: 'Verpakt supermarktproduct',
      category: 'Algemeen',
      expiryDays: 5,
      confidence: 0.67,
      notes: 'Barcodepatroon lijkt op een standaard retailproduct uit een supermarktflow.',
    },
    {
      prefix: ['54'],
      name: 'Belgisch winkelproduct',
      category: 'Algemeen',
      expiryDays: 4,
      confidence: 0.65,
      notes: 'Barcodepatroon wijst op een Belgisch retailproduct. Controleer naam en categorie.',
    },
  ],

  /**
   * Infer product metadata from barcode prefix.
   * @param {string} barcode - The barcode value to check
   * @returns {object|null} Inferred product metadata or null if no match
   */
  inferFromBarcode(barcode) {
    if (!barcode) return null;

    for (const pattern of this.BARCODE_PATTERNS) {
      for (const prefix of pattern.prefix) {
        if (barcode.startsWith(prefix)) {
          const { prefix: _, ...metadata } = pattern;
          return metadata;
        }
      }
    }

    return null;
  },
};
