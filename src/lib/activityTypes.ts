import type { IconName } from '../components/ui';

export type ActivityTypeDef = {
  key: string;
  label: string;
  icon: IconName;
  /** MET-Wert für die Kalorienschätzung (kcal = MET × kg × Stunden). */
  met: number;
  /** ExerciseType in Google Health Connect. */
  healthConnectType: number;
  /** HKWorkoutActivityType in Apple Health. */
  healthKitType: number;
};

// Die Zahlen entsprechen den Konstanten der beiden Plattformen. Sie stehen hier direkt,
// damit diese Datei keine nativen Module lädt (wichtig für Expo Go).
export const ACTIVITY_TYPES: ActivityTypeDef[] = [
  { key: 'strength', label: 'Krafttraining', icon: 'barbell', met: 5.0, healthConnectType: 70, healthKitType: 50 },
  { key: 'running', label: 'Laufen', icon: 'walk', met: 9.8, healthConnectType: 56, healthKitType: 37 },
  { key: 'walking', label: 'Gehen', icon: 'footsteps', met: 3.5, healthConnectType: 79, healthKitType: 52 },
  { key: 'cycling', label: 'Radfahren', icon: 'bicycle', met: 7.5, healthConnectType: 8, healthKitType: 13 },
  { key: 'hiit', label: 'HIIT', icon: 'flash', met: 8.0, healthConnectType: 36, healthKitType: 63 },
  { key: 'swimming', label: 'Schwimmen', icon: 'water', met: 7.0, healthConnectType: 74, healthKitType: 46 },
  { key: 'yoga', label: 'Yoga', icon: 'body', met: 2.5, healthConnectType: 83, healthKitType: 57 },
  { key: 'hiking', label: 'Wandern', icon: 'trail-sign', met: 6.0, healthConnectType: 37, healthKitType: 24 },
  { key: 'soccer', label: 'Fußball', icon: 'football', met: 7.0, healthConnectType: 64, healthKitType: 41 },
  { key: 'other', label: 'Sonstiges', icon: 'fitness', met: 4.0, healthConnectType: 0, healthKitType: 3000 },
];

const OTHER = ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];

export function getActivityType(key: string): ActivityTypeDef {
  return ACTIVITY_TYPES.find((t) => t.key === key) ?? OTHER;
}

export function activityTypeFromHealthConnect(hcType: number): ActivityTypeDef {
  return ACTIVITY_TYPES.find((t) => t.healthConnectType === hcType) ?? OTHER;
}

export function activityTypeFromHealthKit(hkType: number): ActivityTypeDef {
  // Funktionelles Krafttraining (20) zählt ebenfalls als Krafttraining
  if (hkType === 20) return ACTIVITY_TYPES[0];
  return ACTIVITY_TYPES.find((t) => t.healthKitType === hkType) ?? OTHER;
}

export function estimateKcal(typeKey: string, durationMin: number, weightKg: number): number {
  const met = getActivityType(typeKey).met;
  return Math.round(met * weightKg * (durationMin / 60));
}
