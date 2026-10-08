import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import {
  getSetting,
  setActivityHealthId,
  setFoodHealthId,
  setSetting,
  type Activity,
  type FoodEntry,
} from '../db/database';
import { EMPTY_SUMMARY, type HealthDaySummary, type HealthProvider, type HealthStatus } from './types';

export type { HealthDaySummary, HealthSession, HealthStatus } from './types';

/**
 * Einstiegspunkt für Gesundheitsdaten – wählt automatisch
 * Google Health Connect (Android) oder Apple Health (iOS).
 *
 * Die nativen Module werden erst bei Bedarf geladen. So startet die App auch in
 * Expo Go (dort fehlen diese Module) – nur eben ohne Gesundheitsdaten.
 */

const ENABLED_KEY = 'healthConnectEnabled';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let cached: HealthProvider | null | undefined;

function provider(): HealthProvider | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (isExpoGo) return cached;
  try {
    if (Platform.OS === 'android') {
      cached = (require('./healthConnect') as typeof import('./healthConnect')).healthConnectProvider;
    } else if (Platform.OS === 'ios') {
      cached = (require('./appleHealth') as typeof import('./appleHealth')).appleHealthProvider;
    }
  } catch (e) {
    console.warn('Gesundheitsmodul konnte nicht geladen werden', e);
  }
  return cached;
}

/** Name der Gesundheits-Plattform dieses Geräts. */
export function healthName(): string {
  return Platform.OS === 'ios' ? 'Apple Health' : 'Google Health Connect';
}

export function healthUnavailableReason(): string {
  if (isExpoGo) {
    return `${healthName()} funktioniert nicht in Expo Go – dafür brauchst du einen eigenen App-Build (siehe README).`;
  }
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return 'Gesundheitsdaten gibt es nur auf Android und iOS.';
  }
  return `${healthName()} ist auf diesem Gerät nicht verfügbar.`;
}

export async function getStatus(): Promise<HealthStatus> {
  const p = provider();
  return p ? p.getStatus() : 'unsupported';
}

/** Ob der Nutzer die Synchronisierung in der App aktiviert hat. */
export async function isEnabled(): Promise<boolean> {
  if (!provider()) return false;
  return (await getSetting(ENABLED_KEY)) === '1';
}

export async function connect(): Promise<boolean> {
  const p = provider();
  if (!p) return false;
  const ok = await p.requestAccess();
  await setSetting(ENABLED_KEY, ok ? '1' : '0');
  return ok;
}

export async function disconnect(): Promise<void> {
  await setSetting(ENABLED_KEY, '0');
}

export async function permissionSummary(): Promise<string | null> {
  return provider()?.permissionSummary() ?? null;
}

export function canOpenSettings(): boolean {
  return !!provider()?.openSettings;
}

export function openSettings(): void {
  provider()?.openSettings?.();
}

export async function fetchDaySummary(dateKey: string): Promise<HealthDaySummary> {
  const p = provider();
  if (!p || !(await isEnabled())) return EMPTY_SUMMARY;
  try {
    return await p.fetchDaySummary(dateKey);
  } catch (e) {
    console.warn('Gesundheitsdaten konnten nicht gelesen werden', e);
    return EMPTY_SUMMARY;
  }
}

/** Überträgt eine Mahlzeit (falls verbunden) und merkt sich die ID für späteres Löschen. */
export async function syncFood(food: FoodEntry): Promise<void> {
  const p = provider();
  if (!p || !(await isEnabled())) return;
  const id = await p.writeFood(food);
  if (id) await setFoodHealthId(food.id, id);
}

export async function syncActivity(activity: Activity): Promise<void> {
  const p = provider();
  if (!p || !(await isEnabled())) return;
  const id = await p.writeActivity(activity);
  if (id) await setActivityHealthId(activity.id, id);
}

export async function removeFood(food: FoodEntry): Promise<void> {
  const p = provider();
  if (!p || !(await isEnabled())) return;
  await p.deleteFood(food);
}

export async function removeActivity(activity: Activity): Promise<void> {
  const p = provider();
  if (!p || !(await isEnabled())) return;
  await p.deleteActivity(activity);
}
