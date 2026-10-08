import { getProduct, saveProduct, type Product } from '../db/database';

/**
 * Produktsuche per Barcode über Open Food Facts (freie Lebensmitteldatenbank, kein API-Key nötig).
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 *
 * Gefundene Produkte werden lokal gespeichert, damit sie beim nächsten Scan auch offline da sind.
 */

const API = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = [
  'product_name',
  'product_name_de',
  'generic_name',
  'brands',
  'serving_quantity',
  'nutriments',
].join(',');

type OffNutriments = Record<string, number | string | undefined>;

type OffResponse = {
  status?: number;
  product?: {
    product_name?: string;
    product_name_de?: string;
    generic_name?: string;
    brands?: string;
    serving_quantity?: number | string;
    nutriments?: OffNutriments;
  };
};

function num(v: number | string | undefined): number {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type LookupResult =
  | { status: 'found'; product: Product; source: 'local' | 'openfoodfacts' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export async function lookupBarcode(barcode: string): Promise<LookupResult> {
  const local = await getProduct(barcode);
  if (local) return { status: 'found', product: local, source: 'local' };

  try {
    const res = await fetch(`${API}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': 'FitTrack/1.0 (private fitness app)' },
    });
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'error', message: `Server antwortet mit ${res.status}` };

    const data = (await res.json()) as OffResponse;
    if (data.status !== 1 || !data.product) return { status: 'not_found' };

    const p = data.product;
    const n = p.nutriments ?? {};
    // Manche Produkte haben nur kJ – dann umrechnen (1 kcal = 4,184 kJ)
    const kcal = num(n['energy-kcal_100g']) || num(n['energy-kj_100g']) / 4.184 || num(n['energy_100g']) / 4.184;
    const baseName = p.product_name_de || p.product_name || p.generic_name || 'Unbekanntes Produkt';
    const brand = p.brands?.split(',')[0]?.trim();
    const serving = num(p.serving_quantity);

    const product: Product = {
      barcode,
      name: brand && !baseName.toLowerCase().includes(brand.toLowerCase()) ? `${baseName} (${brand})` : baseName,
      kcal: Math.round(kcal),
      protein: round1(num(n['proteins_100g'])),
      carbs: round1(num(n['carbohydrates_100g'])),
      fat: round1(num(n['fat_100g'])),
      serving_g: serving > 0 ? serving : null,
    };
    await saveProduct(product);
    return { status: 'found', product, source: 'openfoodfacts' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
