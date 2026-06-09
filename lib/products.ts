import { PRODUCTS as SERVER_PRODUCTS } from './products-server';

export type Product = {
  id: string;
  name: string;
  category: string;
  barcode?: string;
  unit: string;
  price: number;
  currency: string;
  suggestedDestination: string;
  fallbackDestination: string;
  reason: string;
  confidence: number;
  requiresPayment: boolean;
  auditLabel: string;
};

export const PRODUCTS: Product[] = SERVER_PRODUCTS;

export function lookupProductByBarcode(barcode: string): Product | null {
  return PRODUCTS.find(product => product.barcode === barcode) || null;
}

export function lookupProductByName(name: string): Product[] {
  const lowerName = name.toLowerCase();
  return PRODUCTS.filter(product => product.name.toLowerCase().includes(lowerName));
}

export function lookupProductById(id: string): Product | null {
  return PRODUCTS.find(product => product.id === id) || null;
}

export function getAllProducts(): Product[] {
  return PRODUCTS;
}
