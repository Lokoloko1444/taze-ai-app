/**
 * Product category inference rules.
 * Maps keywords to product categories for auto-classification.
 */

module.exports = {
  CATEGORY_KEYWORDS: [
    {
      category: 'Zuivel',
      keywords: ['zuivel', 'milk', 'yoghurt', 'cheese', 'melk', 'kaas', 'room', 'boter'],
    },
    {
      category: 'Bakkerij',
      keywords: ['brood', 'bread', 'bakery', 'croissant', 'brioche', 'baguette', 'gebak', 'bakker'],
    },
    {
      category: 'Dranken',
      keywords: ['drank', 'drink', 'water', 'juice', 'cola', 'sap', 'fris', 'koffie', 'thee'],
    },
    {
      category: 'Groente & fruit',
      keywords: ['fruit', 'groente', 'vegetable', 'salade', 'sla', 'bessen', 'vers'],
    },
    {
      category: 'Vers',
      keywords: ['vlees', 'fish', 'kip', 'meat', 'rund', 'vis', 'zalm', 'tonijn'],
    },
    {
      category: 'Diepvries',
      keywords: ['diepvries', 'frozen', 'vries'],
    },
    {
      category: 'Droogwaren',
      keywords: ['pasta', 'rijst', 'dry', 'blik', 'droog'],
    },
  ],

  EXPIRY_ESTIMATES: [
    {
      category: 'Zuivel',
      keywords: ['melk', 'yoghurt', 'kaas', 'room', 'boter', 'zuivel'],
      expiryDays: 5,
    },
    {
      category: 'Bakkerij',
      keywords: ['brood', 'bakker', 'croissant', 'brioche', 'baguette', 'gebak'],
      expiryDays: 1,
    },
    {
      category: 'Groente & fruit',
      keywords: ['salade', 'sla', 'fruit', 'groente', 'groenten', 'bessen', 'vers'],
      expiryDays: 3,
    },
    {
      category: 'Vers',
      keywords: ['vlees', 'kip', 'rund', 'vis', 'zalm', 'tonijn'],
      expiryDays: 2,
    },
    {
      category: 'Dranken',
      keywords: ['drank', 'water', 'sap', 'cola', 'fris', 'koffie', 'thee'],
      expiryDays: 7,
    },
    {
      category: 'Diepvries',
      keywords: ['diepvries', 'frozen', 'vries'],
      expiryDays: 30,
    },
    {
      category: 'Droogwaren',
      keywords: ['pasta', 'rijst', 'droog', 'blik'],
      expiryDays: 90,
    },
  ],

  /**
   * Derive category from text keywords.
   * @param {string} text - Text to analyze
   * @returns {string} Category name or 'Algemeen' as fallback
   */
  deriveCategoryFromText(text) {
    const value = String(text || '').trim().toLowerCase();

    for (const rule of this.CATEGORY_KEYWORDS) {
      for (const keyword of rule.keywords) {
        if (value.includes(keyword)) {
          return rule.category;
        }
      }
    }

    return 'Algemeen';
  },

  /**
   * Estimate expiry days from text keywords.
   * @param {string} text - Text to analyze
   * @returns {number} Estimated expiry days or 7 as fallback
   */
  estimateExpiryDaysFromText(text) {
    const value = String(text || '').trim().toLowerCase();

    for (const rule of this.EXPIRY_ESTIMATES) {
      for (const keyword of rule.keywords) {
        if (value.includes(keyword)) {
          return rule.expiryDays;
        }
      }
    }

    return 7; // Default fallback
  },
};
