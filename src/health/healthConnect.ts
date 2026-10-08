import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  aggregateRecord,
  deleteRecordsByUuids,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  insertRecords,
  MealType as HCMealType,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
} from 'react-native-health-connect';

import { getSetting, setSetting, type Activity, type FoodEntry, type MealType } from '../db/database';
import { dayRange, fromDateKey, todayKey } from '../lib/date';
import { getActivityType } from '../lib/activityTypes';

/**
 * Anbindung an Google Health Connect (nur Android).
 *
 * Gelesen werden Schritte, verbrannte Kalorien und Trainingseinheiten anderer Apps
 * (z. B. Smartwatch, Google Fit, Samsung Health). Mahlzeiten und Aktivitäten, die in
 * dieser App erfasst werden, werden zusätzlich nach Health Connect geschrieben.
 */

export const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'Nutrition' },
];

const OWN_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.nilas.fittrack';
const ENABLED_KEY = 'healthConnectEnabled';

export type HealthConnectStatus = 'unsupported' | 'not_installed' | 'update_required' | 'available';

export type HealthSession = {
  id: string;
  title: string;
  exerciseType: number;
  startTime: string;
  endTime: string;
  durationMin: number;
  source: string;
};

export type HealthDaySummary = {
  steps: number | null;
  activeKcal: number | null;
  totalKcal: number | null;
  sessions: HealthSession[];
};

const EMPTY_SUMMARY: HealthDaySummary = {
  steps: null,
  activeKcal: null,
  totalKcal: null,
  sessions: [],
};

let initPromise: Promise<boolean> | null = null;

function ensureInitialized(): Promise<boolean> {
  if (!initPromise) {
    initPromise = initialize().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

export async function getStatus(): Promise<HealthConnectStatus> {
  if (Platform.OS !== 'android') return 'unsupported';
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'update_required';
    }
    return 'not_installed';
  } catch {
    // z. B. in Expo Go, wo das native Modul fehlt
    return 'unsupported';
  }
}

/** Ob der Nutzer die Verbindung in der App aktiviert hat. */
export async function isEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return (await getSetting(ENABLED_KEY)) === '1';
}

/** Fragt die Berechtigungen an und aktiviert die Synchronisierung. Gibt die Anzahl erteilter Rechte zurück. */
export async function connect(): Promise<number> {
  await ensureInitialized();
  const granted = await requestPermission(PERMISSIONS);
  await setSetting(ENABLED_KEY, granted.length > 0 ? '1' : '0');
  return granted.length;
}

export async function disconnect(): Promise<void> {
  await setSetting(ENABLED_KEY, '0');
}

export async function getGrantedCount(): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  try {
    await ensureInitialized();
    return (await getGrantedPermissions()).length;
  } catch {
    return 0;
  }
}

export function openSettings(): void {
  openHealthConnectSettings();
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.warn('[HealthConnect]', e);
    return null;
  }
}

/** Liest Schritte, Kalorien und Trainingseinheiten (anderer Apps) für einen Tag. */
export async function fetchDaySummary(dateKey: string): Promise<HealthDaySummary> {
  if (!(await isEnabled())) return EMPTY_SUMMARY;
  try {
    await ensureInitialized();
  } catch {
    return EMPTY_SUMMARY;
  }

  const { start, end } = dayRange(dateKey);
  const timeRangeFilter = { operator: 'between' as const, startTime: start, endTime: end };

  const [steps, active, total, sessions] = await Promise.all([
    safe(() => aggregateRecord({ recordType: 'Steps', timeRangeFilter })),
    safe(() => aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter })),
    safe(() => aggregateRecord({ recordType: 'TotalCaloriesBurned', timeRangeFilter })),
    safe(() => readRecords('ExerciseSession', { timeRangeFilter })),
  ]);

  return {
    steps: steps ? steps.COUNT_TOTAL : null,
    activeKcal: active ? Math.round(active.ACTIVE_CALORIES_TOTAL.inKilocalories) : null,
    totalKcal: total ? Math.round(total.ENERGY_TOTAL.inKilocalories) : null,
    sessions: (sessions?.records ?? [])
      // Eigene Einträge stehen schon in der lokalen Datenbank
      .filter((r) => r.metadata?.dataOrigin !== OWN_PACKAGE)
      .map((r) => ({
        id: r.metadata?.id ?? `${r.startTime}`,
        title: r.title ?? '',
        exerciseType: r.exerciseType,
        startTime: r.startTime,
        endTime: r.endTime,
        durationMin: Math.round(
          (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 60000
        ),
        source: r.metadata?.dataOrigin ?? '',
      })),
  };
}

/**
 * Zeitpunkt für einen Eintrag: heute → jetzt, sonst 12:00 Uhr am gewählten Tag.
 * Health Connect akzeptiert keine Einträge in der Zukunft.
 */
function entryTime(dateKey: string): Date {
  if (dateKey === todayKey()) return new Date();
  const d = fromDateKey(dateKey);
  d.setHours(12, 0, 0, 0);
  return d;
}

const MEAL_TO_HC: Record<MealType, number> = {
  breakfast: HCMealType.BREAKFAST,
  lunch: HCMealType.LUNCH,
  dinner: HCMealType.DINNER,
  snack: HCMealType.SNACK,
};

const MANUAL_ENTRY = 3; // RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY

export async function writeFood(food: FoodEntry): Promise<boolean> {
  if (!(await isEnabled())) return false;
  const end = entryTime(food.date);
  const start = new Date(end.getTime() - 60_000);
  const result = await safe(async () => {
    await ensureInitialized();
    return insertRecords([
      {
        recordType: 'Nutrition',
        name: food.name,
        mealType: MEAL_TO_HC[food.meal],
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        energy: { value: food.kcal, unit: 'kilocalories' },
        protein: { value: food.protein, unit: 'grams' },
        totalCarbohydrate: { value: food.carbs, unit: 'grams' },
        totalFat: { value: food.fat, unit: 'grams' },
        metadata: { clientRecordId: `food-${food.id}`, recordingMethod: MANUAL_ENTRY },
      },
    ]);
  });
  return result !== null;
}

export async function writeActivity(activity: Activity): Promise<boolean> {
  if (!(await isEnabled())) return false;
  const end = entryTime(activity.date);
  const start = new Date(end.getTime() - Math.max(1, activity.duration_min) * 60_000);
  const result = await safe(async () => {
    await ensureInitialized();
    return insertRecords([
      {
        recordType: 'ExerciseSession',
        exerciseType: getActivityType(activity.type).healthConnectType,
        title: activity.title,
        notes: activity.notes || undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        metadata: { clientRecordId: `activity-${activity.id}`, recordingMethod: MANUAL_ENTRY },
      },
    ]);
  });
  return result !== null;
}

export async function deleteFoodRecord(id: number): Promise<void> {
  if (!(await isEnabled())) return;
  await safe(async () => {
    await ensureInitialized();
    await deleteRecordsByUuids('Nutrition', [], [`food-${id}`]);
  });
}

export async function deleteActivityRecord(id: number): Promise<void> {
  if (!(await isEnabled())) return;
  await safe(async () => {
    await ensureInitialized();
    await deleteRecordsByUuids('ExerciseSession', [], [`activity-${id}`]);
  });
}
