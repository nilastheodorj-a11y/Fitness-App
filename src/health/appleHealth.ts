import {
  AuthorizationStatus,
  authorizationStatusFor,
  deleteObjects,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
  saveQuantitySample,
  saveWorkoutSample,
  type QuantityTypeIdentifierWriteable,
} from '@kingstinct/react-native-healthkit';
import Constants from 'expo-constants';

import type { Activity, FoodEntry } from '../db/database';
import { activityTypeFromHealthKit, getActivityType } from '../lib/activityTypes';
import { fromDateKey } from '../lib/date';
import { entryTime, safe } from './time';
import { type HealthProvider } from './types';

/**
 * Apple Health / HealthKit (iOS).
 * Diese Datei wird nur auf iOS und nur außerhalb von Expo Go geladen (siehe health/index.ts).
 */

const LABEL = 'AppleHealth';
const OWN_BUNDLE = Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.nilas.fittrack';

const WORKOUT = 'HKWorkoutTypeIdentifier' as const;
const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;
const ACTIVE_ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const BASAL_ENERGY = 'HKQuantityTypeIdentifierBasalEnergyBurned' as const;
const DIETARY_ENERGY = 'HKQuantityTypeIdentifierDietaryEnergyConsumed' as const;
const DIETARY_PROTEIN = 'HKQuantityTypeIdentifierDietaryProtein' as const;
const DIETARY_CARBS = 'HKQuantityTypeIdentifierDietaryCarbohydrates' as const;
const DIETARY_FAT = 'HKQuantityTypeIdentifierDietaryFatTotal' as const;

const NUTRITION_TYPES: QuantityTypeIdentifierWriteable[] = [
  DIETARY_ENERGY,
  DIETARY_PROTEIN,
  DIETARY_CARBS,
  DIETARY_FAT,
];

const TO_SHARE = [WORKOUT, ...NUTRITION_TYPES] as const;
const TO_READ = [STEPS, ACTIVE_ENERGY, BASAL_ENERGY, WORKOUT] as const;

function dayFilter(dateKey: string) {
  const startDate = fromDateKey(dateKey);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  return { date: { startDate, endDate } };
}

async function sumKcal(
  identifier: typeof ACTIVE_ENERGY | typeof BASAL_ENERGY,
  dateKey: string
): Promise<number | null> {
  const res = await safe(LABEL, () =>
    queryStatisticsForQuantity(identifier, ['cumulativeSum'], {
      filter: dayFilter(dateKey),
      unit: 'kcal',
    })
  );
  return res?.sumQuantity ? Math.round(res.sumQuantity.quantity) : null;
}

export const appleHealthProvider: HealthProvider = {
  name: 'Apple Health',

  async getStatus() {
    try {
      return isHealthDataAvailable() ? 'available' : 'unsupported';
    } catch {
      return 'unsupported';
    }
  },

  async requestAccess() {
    // iOS verrät aus Datenschutzgründen nicht, ob Lesezugriff erlaubt wurde.
    // true heißt nur: der Dialog wurde angezeigt.
    return requestAuthorization({ toShare: TO_SHARE, toRead: TO_READ });
  },

  async permissionSummary() {
    try {
      const allowed = TO_SHARE.filter(
        (t) => authorizationStatusFor(t) === AuthorizationStatus.sharingAuthorized
      ).length;
      return `Schreiben erlaubt für ${allowed} von ${TO_SHARE.length} Datentypen`;
    } catch {
      return null;
    }
  },

  // Apps dürfen die Health-App nicht direkt öffnen; Berechtigungen ändert man in
  // Einstellungen › Gesundheit › Datenzugriff & Geräte › FitTrack.
  openSettings: null,

  async fetchDaySummary(dateKey) {
    const [stepsRes, active, basal, workouts] = await Promise.all([
      safe(LABEL, () =>
        queryStatisticsForQuantity(STEPS, ['cumulativeSum'], { filter: dayFilter(dateKey), unit: 'count' })
      ),
      sumKcal(ACTIVE_ENERGY, dateKey),
      sumKcal(BASAL_ENERGY, dateKey),
      safe(LABEL, () => queryWorkoutSamples({ filter: dayFilter(dateKey), limit: 0, ascending: true })),
    ]);

    return {
      steps: stepsRes?.sumQuantity ? Math.round(stepsRes.sumQuantity.quantity) : null,
      // Eigene Workouts speichern Kalorien nur als Workout-Summe, nicht als
      // „Aktive Energie“ – hier wird also nichts doppelt gezählt.
      activeKcal: active,
      totalKcal: active != null || basal != null ? (active ?? 0) + (basal ?? 0) : null,
      sessions: (workouts ?? [])
        .filter((w) => w.sourceRevision?.source?.bundleIdentifier !== OWN_BUNDLE)
        .map((w) => {
          const type = activityTypeFromHealthKit(w.workoutActivityType);
          const start = new Date(w.startDate);
          const end = new Date(w.endDate);
          return {
            id: w.uuid,
            title: type.label,
            activityType: type.key,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            durationMin: Math.round((end.getTime() - start.getTime()) / 60000),
            kcal: w.totalEnergyBurned ? Math.round(w.totalEnergyBurned.quantity) : null,
          };
        }),
    };
  },

  async writeFood(food: FoodEntry) {
    const end = entryTime(food.date);
    const start = new Date(end.getTime() - 60_000);
    const metadata = { HKFoodType: food.name, FitTrackId: `food-${food.id}` };
    const values: [QuantityTypeIdentifierWriteable, number, string][] = [
      [DIETARY_ENERGY, food.kcal, 'kcal'],
      [DIETARY_PROTEIN, food.protein, 'g'],
      [DIETARY_CARBS, food.carbs, 'g'],
      [DIETARY_FAT, food.fat, 'g'],
    ];
    const ids: string[] = [];
    for (const [type, value, unit] of values) {
      if (value <= 0) continue;
      const sample = await safe(LABEL, () =>
        // Einheiten sind pro Typ fest; der Cast vermeidet die sehr strengen generischen Typen
        saveQuantitySample(type, unit as never, value, start, end, metadata as never)
      );
      if (sample?.uuid) ids.push(sample.uuid);
    }
    return ids.length > 0 ? ids.join(',') : null;
  },

  async writeActivity(activity: Activity) {
    const end = entryTime(activity.date);
    const start = new Date(end.getTime() - Math.max(1, activity.duration_min) * 60_000);
    const workout = await safe(LABEL, () =>
      saveWorkoutSample(
        getActivityType(activity.type).healthKitType,
        [],
        start,
        end,
        activity.kcal > 0 ? { energyBurned: activity.kcal } : undefined,
        { FitTrackId: `activity-${activity.id}`, HKWorkoutBrandName: activity.title }
      )
    );
    return workout?.uuid ?? null;
  },

  async deleteFood(food: FoodEntry) {
    const uuids = food.health_id?.split(',').filter(Boolean) ?? [];
    if (uuids.length === 0) return;
    for (const type of NUTRITION_TYPES) {
      await safe(LABEL, () => deleteObjects(type, { uuids }));
    }
  },

  async deleteActivity(activity: Activity) {
    if (!activity.health_id) return;
    await safe(LABEL, () => deleteObjects(WORKOUT, { uuid: activity.health_id! }));
  },
};
