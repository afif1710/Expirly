import { api } from '../lib/api';

export interface FoodProduct {
  found: boolean;
  barcode: string;
  product_name: string;
  brand: string;
  category: string;
}

/**
 * Lookup a food product by barcode via the backend proxy.
 * - Returns null if product is not in the food database (404)
 * - Throws an error for service failures (503, network errors)
 *   so callers can show the correct error UI
 */
export async function lookupBarcode(barcode: string): Promise<FoodProduct | null> {
  try {
    const result = await api.get(`/api/food/lookup?barcode=${encodeURIComponent(barcode.trim())}`);
    return result as FoodProduct;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    // Product simply not in the food database → caller shows 'not found' UI
    if (msg.includes('not found') || msg.includes('name unavailable')) {
      return null;
    }
    // Service/network error → re-throw so caller shows 'service error' UI
    throw err;
  }
}
