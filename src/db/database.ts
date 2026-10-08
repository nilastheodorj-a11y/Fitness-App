import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('fittrack.db');

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
};

export type FoodEntry = {
  id: number;
  date: string;
  meal: MealType;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
};

export type Activity = {
  id: number;
  date: string;
  type: string;
  title: string;
  duration_min: number;
  kcal: number;
  notes: string;
  exercise_id: number | null;
  created_at: string;
};

export type Exercise = {
  id: number;
  name: string;
  muscle_group: string;
  description: string;
  sets: number | null;
  reps: string;
  video_uri: string | null;
  created_at: string;
};

export type Goals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const DEFAULT_GOALS: Goals = { kcal: 2200, protein: 150, carbs: 250, fat: 70 };

export async function initDatabase(): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal TEXT NOT NULL,
      name TEXT NOT NULL,
      kcal REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_foods_date ON foods(date);
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      duration_min INTEGER NOT NULL DEFAULT 0,
      kcal REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      exercise_id INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      muscle_group TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      sets INTEGER,
      reps TEXT NOT NULL DEFAULT '',
      video_uri TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

// ---------- Einstellungen ----------

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

export async function getGoals(): Promise<Goals> {
  const raw = await getSetting('goals');
  if (!raw) return DEFAULT_GOALS;
  try {
    return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_GOALS;
  }
}

export async function saveGoals(goals: Goals): Promise<void> {
  await setSetting('goals', JSON.stringify(goals));
}

// ---------- Ernährung ----------

export async function getFoodsForDate(date: string): Promise<FoodEntry[]> {
  return db.getAllAsync<FoodEntry>(
    'SELECT * FROM foods WHERE date = ? ORDER BY created_at ASC',
    date
  );
}

export async function addFood(entry: Omit<FoodEntry, 'id' | 'created_at'>): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO foods (date, meal, name, kcal, protein, carbs, fat, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    entry.date,
    entry.meal,
    entry.name,
    entry.kcal,
    entry.protein,
    entry.carbs,
    entry.fat,
    new Date().toISOString()
  );
  return result.lastInsertRowId;
}

export async function deleteFood(id: number): Promise<void> {
  await db.runAsync('DELETE FROM foods WHERE id = ?', id);
}

/** Zuletzt gegessene Lebensmittel (eindeutig nach Name) für schnelles Wiederhinzufügen. */
export async function getRecentFoods(limit = 15): Promise<FoodEntry[]> {
  return db.getAllAsync<FoodEntry>(
    `SELECT * FROM foods WHERE id IN (SELECT MAX(id) FROM foods GROUP BY name)
     ORDER BY created_at DESC LIMIT ?`,
    limit
  );
}

export type MacroTotals = { kcal: number; protein: number; carbs: number; fat: number };

export async function getMacroTotals(date: string): Promise<MacroTotals> {
  const row = await db.getFirstAsync<MacroTotals>(
    `SELECT COALESCE(SUM(kcal),0) AS kcal, COALESCE(SUM(protein),0) AS protein,
            COALESCE(SUM(carbs),0) AS carbs, COALESCE(SUM(fat),0) AS fat
     FROM foods WHERE date = ?`,
    date
  );
  return row ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
}

export async function getKcalInByDay(from: string, to: string): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ date: string; kcal: number }>(
    'SELECT date, SUM(kcal) AS kcal FROM foods WHERE date BETWEEN ? AND ? GROUP BY date',
    from,
    to
  );
  return Object.fromEntries(rows.map((r) => [r.date, r.kcal]));
}

// ---------- Aktivitäten ----------

export async function getActivitiesForDate(date: string): Promise<Activity[]> {
  return db.getAllAsync<Activity>(
    'SELECT * FROM activities WHERE date = ? ORDER BY created_at ASC',
    date
  );
}

export async function addActivity(
  activity: Omit<Activity, 'id' | 'created_at'>
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO activities (date, type, title, duration_min, kcal, notes, exercise_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    activity.date,
    activity.type,
    activity.title,
    activity.duration_min,
    activity.kcal,
    activity.notes,
    activity.exercise_id,
    new Date().toISOString()
  );
  return result.lastInsertRowId;
}

export async function deleteActivity(id: number): Promise<void> {
  await db.runAsync('DELETE FROM activities WHERE id = ?', id);
}

export async function getKcalOutByDay(from: string, to: string): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ date: string; kcal: number }>(
    'SELECT date, SUM(kcal) AS kcal FROM activities WHERE date BETWEEN ? AND ? GROUP BY date',
    from,
    to
  );
  return Object.fromEntries(rows.map((r) => [r.date, r.kcal]));
}

// ---------- Übungen ----------

export async function getExercises(): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY name COLLATE NOCASE ASC');
}

export async function getExercise(id: number): Promise<Exercise | null> {
  return db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', id);
}

export async function addExercise(
  exercise: Omit<Exercise, 'id' | 'created_at'>
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO exercises (name, muscle_group, description, sets, reps, video_uri, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    exercise.name,
    exercise.muscle_group,
    exercise.description,
    exercise.sets,
    exercise.reps,
    exercise.video_uri,
    new Date().toISOString()
  );
  return result.lastInsertRowId;
}

export async function updateExercise(exercise: Omit<Exercise, 'created_at'>): Promise<void> {
  await db.runAsync(
    'UPDATE exercises SET name = ?, muscle_group = ?, description = ?, sets = ?, reps = ?, video_uri = ? WHERE id = ?',
    exercise.name,
    exercise.muscle_group,
    exercise.description,
    exercise.sets,
    exercise.reps,
    exercise.video_uri,
    exercise.id
  );
}

export async function deleteExercise(id: number): Promise<void> {
  await db.runAsync('DELETE FROM exercises WHERE id = ?', id);
}

export async function getExerciseHistory(exerciseId: number, limit = 10): Promise<Activity[]> {
  return db.getAllAsync<Activity>(
    'SELECT * FROM activities WHERE exercise_id = ? ORDER BY date DESC, created_at DESC LIMIT ?',
    exerciseId,
    limit
  );
}
