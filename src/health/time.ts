import { fromDateKey, todayKey } from '../lib/date';

/**
 * Zeitpunkt für einen Eintrag: heute → jetzt, sonst 12:00 Uhr am gewählten Tag.
 * Gesundheits-Apps akzeptieren keine Einträge in der Zukunft.
 */
export function entryTime(dateKey: string): Date {
  if (dateKey === todayKey()) return new Date();
  const d = fromDateKey(dateKey);
  d.setHours(12, 0, 0, 0);
  return d;
}

export async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`[${label}]`, e);
    return null;
  }
}
