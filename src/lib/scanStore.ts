import type { Product } from '../db/database';

/**
 * Übergibt das Scan-Ergebnis vom Scanner-Bildschirm an das Mahlzeiten-Formular.
 * (Expo Router hat keine eingebaute „Ergebnis zurückgeben“-Funktion.)
 */
export type ScanResult = { barcode: string; product: Product | null };

let pending: ScanResult | null = null;

export function setScanResult(result: ScanResult): void {
  pending = result;
}

export function takeScanResult(): ScanResult | null {
  const r = pending;
  pending = null;
  return r;
}
