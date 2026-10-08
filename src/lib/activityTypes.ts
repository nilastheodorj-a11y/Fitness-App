import { ExerciseType } from 'react-native-health-connect';

export type ActivityTypeDef = {
  key: string;
  label: string;
  icon: string; // Ionicons-Name
  /** MET-Wert für die Kalorienschätzung (kcal = MET × kg × Stunden). */
  met: number;
  healthConnectType: number;
};

export const ACTIVITY_TYPES: ActivityTypeDef[] = [
  { key: 'strength', label: 'Krafttraining', icon: 'barbell', met: 5.0, healthConnectType: ExerciseType.STRENGTH_TRAINING },
  { key: 'running', label: 'Laufen', icon: 'walk', met: 9.8, healthConnectType: ExerciseType.RUNNING },
  { key: 'walking', label: 'Gehen', icon: 'footsteps', met: 3.5, healthConnectType: ExerciseType.WALKING },
  { key: 'cycling', label: 'Radfahren', icon: 'bicycle', met: 7.5, healthConnectType: ExerciseType.BIKING },
  { key: 'hiit', label: 'HIIT', icon: 'flash', met: 8.0, healthConnectType: ExerciseType.HIGH_INTENSITY_INTERVAL_TRAINING },
  { key: 'swimming', label: 'Schwimmen', icon: 'water', met: 7.0, healthConnectType: ExerciseType.SWIMMING_POOL },
  { key: 'yoga', label: 'Yoga', icon: 'body', met: 2.5, healthConnectType: ExerciseType.YOGA },
  { key: 'hiking', label: 'Wandern', icon: 'trail-sign', met: 6.0, healthConnectType: ExerciseType.HIKING },
  { key: 'soccer', label: 'Fußball', icon: 'football', met: 7.0, healthConnectType: ExerciseType.SOCCER },
  { key: 'other', label: 'Sonstiges', icon: 'fitness', met: 4.0, healthConnectType: ExerciseType.OTHER_WORKOUT },
];

export function getActivityType(key: string): ActivityTypeDef {
  return ACTIVITY_TYPES.find((t) => t.key === key) ?? ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
}

/** Sucht den passenden App-Typ zu einem Health-Connect-Übungstyp. */
export function activityTypeFromHealthConnect(hcType: number): ActivityTypeDef {
  return (
    ACTIVITY_TYPES.find((t) => t.healthConnectType === hcType) ??
    ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1]
  );
}

export function estimateKcal(typeKey: string, durationMin: number, weightKg: number): number {
  const met = getActivityType(typeKey).met;
  return Math.round(met * weightKg * (durationMin / 60));
}
