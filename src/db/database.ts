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
  /** ID(s) des Eintrags in Health Connect / Apple Health (kommagetrennt). */
  health_id: string | null;
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
  workout_id: number | null;
  created_at: string;
  health_id: string | null;
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

/** Nährwerte eines Produkts pro 100 g (aus Open Food Facts oder selbst eingegeben). */
export type Product = {
  barcode: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_g: number | null;
};

export type Workout = {
  id: number;
  name: string;
  notes: string;
  created_at: string;
};

export type WorkoutItem = {
  id: number;
  workout_id: number;
  exercise_id: number;
  position: number;
  sets: number;
  reps: string;
  rest_sec: number;
};

export type WorkoutItemWithExercise = WorkoutItem & {
  exercise_name: string;
  muscle_group: string;
  video_uri: string | null;
  description: string;
};

export type SetLog = {
  id: number;
  activity_id: number;
  exercise_id: number;
  set_index: number;
  reps: number;
  weight: number;
};

export type Goals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const DEFAULT_GOALS: Goals = { kcal: 2200, protein: 150, carbs: 250, fat: 70 };

const SCHEMA_VERSION = 2;

async function hasColumn(table: string, column: string): Promise<boolean> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.some((c) => c.name === column);
}

async function addColumnIfMissing(table: string, column: string, definition: string) {
  if (!(await hasColumn(table, column))) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function initDatabase(): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
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

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 2) {
    // v2: Health-IDs, Barcode-Produkte, Trainingspläne und Satz-Protokolle
    await addColumnIfMissing('foods', 'health_id', 'TEXT');
    await addColumnIfMissing('activities', 'health_id', 'TEXT');
    await addColumnIfMissing('activities', 'workout_id', 'INTEGER');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        barcode TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        kcal REAL NOT NULL DEFAULT 0,
        protein REAL NOT NULL DEFAULT 0,
        carbs REAL NOT NULL DEFAULT 0,
        fat REAL NOT NULL DEFAULT 0,
        serving_g REAL
      );
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workout_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        sets INTEGER NOT NULL DEFAULT 3,
        reps TEXT NOT NULL DEFAULT '10',
        rest_sec INTEGER NOT NULL DEFAULT 90
      );
      CREATE INDEX IF NOT EXISTS idx_workout_items_workout ON workout_items(workout_id);
      CREATE TABLE IF NOT EXISTS set_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL,
        set_index INTEGER NOT NULL,
        reps INTEGER NOT NULL DEFAULT 0,
        weight REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_id);
      CREATE INDEX IF NOT EXISTS idx_set_logs_activity ON set_logs(activity_id);
    `);
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
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

export async function getBodyWeight(): Promise<number> {
  const w = parseFloat((await getSetting('weightKg')) ?? '');
  return Number.isFinite(w) && w > 0 ? w : 75;
}

// ---------- Ernährung ----------

export async function getFoodsForDate(date: string): Promise<FoodEntry[]> {
  return db.getAllAsync<FoodEntry>(
    'SELECT * FROM foods WHERE date = ? ORDER BY created_at ASC',
    date
  );
}

export async function addFood(
  entry: Omit<FoodEntry, 'id' | 'created_at' | 'health_id'>
): Promise<FoodEntry> {
  const created_at = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO foods (date, meal, name, kcal, protein, carbs, fat, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    entry.date,
    entry.meal,
    entry.name,
    entry.kcal,
    entry.protein,
    entry.carbs,
    entry.fat,
    created_at
  );
  return { ...entry, id: result.lastInsertRowId, created_at, health_id: null };
}

export async function setFoodHealthId(id: number, healthId: string): Promise<void> {
  await db.runAsync('UPDATE foods SET health_id = ? WHERE id = ?', healthId, id);
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

// ---------- Produkte (Barcode) ----------

export async function getProduct(barcode: string): Promise<Product | null> {
  return db.getFirstAsync<Product>('SELECT * FROM products WHERE barcode = ?', barcode);
}

export async function saveProduct(p: Product): Promise<void> {
  await db.runAsync(
    `INSERT INTO products (barcode, name, kcal, protein, carbs, fat, serving_g) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(barcode) DO UPDATE SET name = excluded.name, kcal = excluded.kcal, protein = excluded.protein,
       carbs = excluded.carbs, fat = excluded.fat, serving_g = excluded.serving_g`,
    p.barcode,
    p.name,
    p.kcal,
    p.protein,
    p.carbs,
    p.fat,
    p.serving_g
  );
}

// ---------- Aktivitäten ----------

export async function getActivitiesForDate(date: string): Promise<Activity[]> {
  return db.getAllAsync<Activity>(
    'SELECT * FROM activities WHERE date = ? ORDER BY created_at ASC',
    date
  );
}

export async function addActivity(
  activity: Omit<Activity, 'id' | 'created_at' | 'health_id'>
): Promise<Activity> {
  const created_at = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO activities (date, type, title, duration_min, kcal, notes, exercise_id, workout_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    activity.date,
    activity.type,
    activity.title,
    activity.duration_min,
    activity.kcal,
    activity.notes,
    activity.exercise_id,
    activity.workout_id,
    created_at
  );
  return { ...activity, id: result.lastInsertRowId, created_at, health_id: null };
}

export async function setActivityHealthId(id: number, healthId: string): Promise<void> {
  await db.runAsync('UPDATE activities SET health_id = ? WHERE id = ?', healthId, id);
}

export async function deleteActivity(id: number): Promise<void> {
  await db.runAsync('DELETE FROM set_logs WHERE activity_id = ?', id);
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
  await db.runAsync('DELETE FROM workout_items WHERE exercise_id = ?', id);
  await db.runAsync('DELETE FROM exercises WHERE id = ?', id);
}

export type ExerciseHistoryEntry = Activity & { sets: SetLog[] };

/** Einzeln eingetragene Trainings und Trainingsplan-Einheiten, in denen die Übung vorkam. */
export async function getExerciseHistory(
  exerciseId: number,
  limit = 10
): Promise<ExerciseHistoryEntry[]> {
  const activities = await db.getAllAsync<Activity>(
    `SELECT DISTINCT a.* FROM activities a
     LEFT JOIN set_logs s ON s.activity_id = a.id
     WHERE a.exercise_id = ? OR s.exercise_id = ?
     ORDER BY a.date DESC, a.created_at DESC LIMIT ?`,
    exerciseId,
    exerciseId,
    limit
  );
  if (activities.length === 0) return [];
  const ids = activities.map((a) => a.id);
  const sets = await db.getAllAsync<SetLog>(
    `SELECT * FROM set_logs WHERE exercise_id = ? AND activity_id IN (${ids.map(() => '?').join(',')})
     ORDER BY set_index ASC`,
    exerciseId,
    ...ids
  );
  return activities.map((a) => ({ ...a, sets: sets.filter((s) => s.activity_id === a.id) }));
}

/** Sätze der letzten Einheit einer Übung – zum Vorausfüllen von Gewicht & Wiederholungen. */
export async function getLastSets(exerciseId: number): Promise<SetLog[]> {
  const last = await db.getFirstAsync<{ activity_id: number }>(
    'SELECT activity_id FROM set_logs WHERE exercise_id = ? ORDER BY id DESC LIMIT 1',
    exerciseId
  );
  if (!last) return [];
  return db.getAllAsync<SetLog>(
    'SELECT * FROM set_logs WHERE exercise_id = ? AND activity_id = ? ORDER BY set_index ASC',
    exerciseId,
    last.activity_id
  );
}

// ---------- Trainingspläne ----------

export type WorkoutSummary = Workout & { exercise_count: number; last_done: string | null };

export async function getWorkouts(): Promise<WorkoutSummary[]> {
  return db.getAllAsync<WorkoutSummary>(
    `SELECT w.*,
       (SELECT COUNT(*) FROM workout_items i WHERE i.workout_id = w.id) AS exercise_count,
       (SELECT MAX(a.date) FROM activities a WHERE a.workout_id = w.id) AS last_done
     FROM workouts w ORDER BY w.name COLLATE NOCASE ASC`
  );
}

export async function getWorkout(id: number): Promise<Workout | null> {
  return db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', id);
}

export async function getWorkoutItems(workoutId: number): Promise<WorkoutItemWithExercise[]> {
  return db.getAllAsync<WorkoutItemWithExercise>(
    `SELECT i.*, e.name AS exercise_name, e.muscle_group, e.video_uri, e.description
     FROM workout_items i JOIN exercises e ON e.id = i.exercise_id
     WHERE i.workout_id = ? ORDER BY i.position ASC`,
    workoutId
  );
}

export type WorkoutItemInput = Pick<WorkoutItem, 'exercise_id' | 'sets' | 'reps' | 'rest_sec'>;

/** Legt einen Plan an oder ersetzt (bei gesetzter id) Name, Notizen und alle Übungen. */
export async function saveWorkout(
  workout: { id?: number; name: string; notes: string },
  items: WorkoutItemInput[]
): Promise<number> {
  let workoutId = workout.id ?? 0;
  await db.withTransactionAsync(async () => {
    if (workout.id) {
      await db.runAsync(
        'UPDATE workouts SET name = ?, notes = ? WHERE id = ?',
        workout.name,
        workout.notes,
        workout.id
      );
      await db.runAsync('DELETE FROM workout_items WHERE workout_id = ?', workout.id);
    } else {
      const res = await db.runAsync(
        'INSERT INTO workouts (name, notes, created_at) VALUES (?, ?, ?)',
        workout.name,
        workout.notes,
        new Date().toISOString()
      );
      workoutId = res.lastInsertRowId;
    }
    for (const [position, item] of items.entries()) {
      await db.runAsync(
        'INSERT INTO workout_items (workout_id, exercise_id, position, sets, reps, rest_sec) VALUES (?, ?, ?, ?, ?, ?)',
        workoutId,
        item.exercise_id,
        position,
        item.sets,
        item.reps,
        item.rest_sec
      );
    }
  });
  return workoutId;
}

export async function deleteWorkout(id: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_items WHERE workout_id = ?', id);
  await db.runAsync('UPDATE activities SET workout_id = NULL WHERE workout_id = ?', id);
  await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
}

export async function getWorkoutHistory(workoutId: number, limit = 10): Promise<Activity[]> {
  return db.getAllAsync<Activity>(
    'SELECT * FROM activities WHERE workout_id = ? ORDER BY date DESC, created_at DESC LIMIT ?',
    workoutId,
    limit
  );
}

export async function addSetLogs(
  activityId: number,
  logs: Pick<SetLog, 'exercise_id' | 'set_index' | 'reps' | 'weight'>[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const l of logs) {
      await db.runAsync(
        'INSERT INTO set_logs (activity_id, exercise_id, set_index, reps, weight) VALUES (?, ?, ?, ?, ?)',
        activityId,
        l.exercise_id,
        l.set_index,
        l.reps,
        l.weight
      );
    }
  });
}
