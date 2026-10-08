/** Lokales Datum als YYYY-MM-DD (nicht UTC, damit Einträge nach Mitternacht richtig landen). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Start und Ende des Tages als ISO-Strings (für Health Connect). */
export function dayRange(key: string): { start: string; end: string } {
  const start = fromDateKey(key);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function formatDayLabel(key: string): string {
  const today = todayKey();
  if (key === today) return 'Heute';
  if (key === addDays(today, -1)) return 'Gestern';
  if (key === addDays(today, 1)) return 'Morgen';
  return fromDateKey(key).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export function shortWeekday(key: string): string {
  return fromDateKey(key).toLocaleDateString('de-DE', { weekday: 'short' });
}
