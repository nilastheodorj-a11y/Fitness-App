import { formatNumber } from '../components/ui';
import type { SetLog } from '../db/database';

/** z. B. „10×60 kg · 8×62,5 kg“ */
export function formatSets(sets: Pick<SetLog, 'reps' | 'weight'>[]): string {
  return sets
    .map((s) => (s.weight > 0 ? `${s.reps}×${formatNumber(s.weight)} kg` : `${s.reps} Wdh.`))
    .join(' · ');
}

/** Sekunden als m:ss bzw. h:mm:ss */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
