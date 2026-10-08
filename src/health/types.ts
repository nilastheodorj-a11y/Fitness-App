import type { Activity, FoodEntry } from '../db/database';

export type HealthStatus = 'unsupported' | 'not_installed' | 'update_required' | 'available';

export type HealthSession = {
  id: string;
  title: string;
  /** App-interner Aktivitätstyp (siehe lib/activityTypes). */
  activityType: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  kcal: number | null;
};

export type HealthDaySummary = {
  steps: number | null;
  activeKcal: number | null;
  totalKcal: number | null;
  /** Trainings aus anderen Apps/Geräten (eigene Einträge sind herausgefiltert). */
  sessions: HealthSession[];
};

export const EMPTY_SUMMARY: HealthDaySummary = {
  steps: null,
  activeKcal: null,
  totalKcal: null,
  sessions: [],
};

/** Gemeinsame Schnittstelle für Google Health Connect (Android) und Apple Health (iOS). */
export interface HealthProvider {
  name: string;
  getStatus(): Promise<HealthStatus>;
  /** Fragt Berechtigungen an. Gibt false zurück, wenn der Nutzer nichts erlaubt hat. */
  requestAccess(): Promise<boolean>;
  /** Kurzer Text zum Berechtigungsstatus, z. B. „5 von 6 Berechtigungen erteilt“. */
  permissionSummary(): Promise<string | null>;
  /** Öffnet die Einstellungen der Gesundheits-App, falls möglich. */
  openSettings: (() => void) | null;
  fetchDaySummary(dateKey: string): Promise<HealthDaySummary>;
  /** Schreibt eine Mahlzeit und gibt die ID(s) des Eintrags zurück. */
  writeFood(food: FoodEntry): Promise<string | null>;
  writeActivity(activity: Activity): Promise<string | null>;
  deleteFood(food: FoodEntry): Promise<void>;
  deleteActivity(activity: Activity): Promise<void>;
}
