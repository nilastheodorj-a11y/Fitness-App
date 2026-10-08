import Constants from 'expo-constants';
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

import type { Activity, FoodEntry, MealType } from '../db/database';
import { activityTypeFromHealthConnect, getActivityType } from '../lib/activityTypes';
import { dayRange } from '../lib/date';
import { entryTime, safe } from './time';
import { EMPTY_SUMMARY, type HealthProvider } from './types';

/**
 * Google Health Connect (Android).
 * Diese Datei wird nur auf Android und nur außerhalb von Expo Go geladen (siehe health/index.ts).
 */

const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'Nutrition' },
];

const OWN_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.nilas.fittrack';
const MANUAL_ENTRY = 3; // RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY
const LABEL = 'HealthConnect';

const MEAL_TO_HC: Record<MealType, number> = {
  breakfast: HCMealType.BREAKFAST,
  lunch: HCMealType.LUNCH,
  dinner: HCMealType.DINNER,
  snack: HCMealType.SNACK,
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

function splitIds(ids: string | null): string[] {
  return ids ? ids.split(',').filter(Boolean) : [];
}

export const healthConnectProvider: HealthProvider = {
  name: 'Google Health Connect',

  async getStatus() {
    try {
      const status = await getSdkStatus();
      if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return 'update_required';
      }
      return 'not_installed';
    } catch {
      return 'unsupported';
    }
  },

  async requestAccess() {
    await ensureInitialized();
    const granted = await requestPermission(PERMISSIONS);
    return granted.length > 0;
  },

  async permissionSummary() {
    const granted = await safe(LABEL, async () => {
      await ensureInitialized();
      return getGrantedPermissions();
    });
    if (!granted) return null;
    return `${granted.length} von ${PERMISSIONS.length} Berechtigungen erteilt`;
  },

  openSettings: () => openHealthConnectSettings(),

  async fetchDaySummary(dateKey) {
    try {
      await ensureInitialized();
    } catch {
      return EMPTY_SUMMARY;
    }
    const { start, end } = dayRange(dateKey);
    const timeRangeFilter = { operator: 'between' as const, startTime: start, endTime: end };

    const [steps, active, total, sessions] = await Promise.all([
      safe(LABEL, () => aggregateRecord({ recordType: 'Steps', timeRangeFilter })),
      safe(LABEL, () => aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter })),
      safe(LABEL, () => aggregateRecord({ recordType: 'TotalCaloriesBurned', timeRangeFilter })),
      safe(LABEL, () => readRecords('ExerciseSession', { timeRangeFilter })),
    ]);

    return {
      steps: steps ? steps.COUNT_TOTAL : null,
      activeKcal: active ? Math.round(active.ACTIVE_CALORIES_TOTAL.inKilocalories) : null,
      totalKcal: total ? Math.round(total.ENERGY_TOTAL.inKilocalories) : null,
      sessions: (sessions?.records ?? [])
        // Eigene Einträge stehen schon in der lokalen Datenbank
        .filter((r) => r.metadata?.dataOrigin !== OWN_PACKAGE)
        .map((r) => {
          const type = activityTypeFromHealthConnect(r.exerciseType);
          return {
            id: r.metadata?.id ?? r.startTime,
            title: r.title || type.label,
            activityType: type.key,
            startTime: r.startTime,
            endTime: r.endTime,
            durationMin: Math.round(
              (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 60000
            ),
            kcal: null,
          };
        }),
    };
  },

  async writeFood(food: FoodEntry) {
    const end = entryTime(food.date);
    const start = new Date(end.getTime() - 60_000);
    const ids = await safe(LABEL, async () => {
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
    return ids?.join(',') ?? null;
  },

  async writeActivity(activity: Activity) {
    const end = entryTime(activity.date);
    const start = new Date(end.getTime() - Math.max(1, activity.duration_min) * 60_000);
    const ids = await safe(LABEL, async () => {
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
    return ids?.join(',') ?? null;
  },

  async deleteFood(food: FoodEntry) {
    await safe(LABEL, async () => {
      await ensureInitialized();
      await deleteRecordsByUuids('Nutrition', splitIds(food.health_id), [`food-${food.id}`]);
    });
  },

  async deleteActivity(activity: Activity) {
    await safe(LABEL, async () => {
      await ensureInitialized();
      await deleteRecordsByUuids('ExerciseSession', splitIds(activity.health_id), [
        `activity-${activity.id}`,
      ]);
    });
  },
};
