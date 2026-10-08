import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColors, useStyles } from '../../components/ThemeContext';
import { radius, spacing, type Colors } from '../../components/theme';
import { Card, DateSwitcher, MacroRow, SectionTitle, type IconName } from '../../components/ui';
import {
  DEFAULT_GOALS,
  getActivitiesForDate,
  getGoals,
  getKcalInByDay,
  getKcalOutByDay,
  getMacroTotals,
  type Goals,
  type MacroTotals,
} from '../../db/database';
import { fetchDaySummary, healthName, isEnabled, type HealthDaySummary } from '../../health';
import { addDays, shortWeekday, todayKey } from '../../lib/date';

type WeekDay = { date: string; kcalIn: number; kcalOut: number };

export default function DashboardScreen() {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const [date, setDate] = useState(todayKey());
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [totals, setTotals] = useState<MacroTotals>({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const [appBurned, setAppBurned] = useState(0);
  const [activityCount, setActivityCount] = useState(0);
  const [health, setHealth] = useState<HealthDaySummary | null>(null);
  const [healthOn, setHealthOn] = useState(false);
  const [week, setWeek] = useState<WeekDay[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [g, t, acts] = await Promise.all([getGoals(), getMacroTotals(date), getActivitiesForDate(date)]);
    setGoals(g);
    setTotals(t);
    setAppBurned(acts.reduce((s, a) => s + a.kcal, 0));
    setActivityCount(acts.length);

    const from = addDays(date, -6);
    const [inMap, outMap] = await Promise.all([getKcalInByDay(from, date), getKcalOutByDay(from, date)]);
    setWeek(
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(from, i);
        return { date: d, kcalIn: inMap[d] ?? 0, kcalOut: outMap[d] ?? 0 };
      })
    );

    setHealthOn(await isEnabled());
    setHealth(await fetchDaySummary(date));
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Verbrannt = in der App erfasste Aktivitäten + aktive Kalorien aus Health Connect / Apple Health.
  // Eigene Aktivitäten werden dort nicht als „aktive Kalorien“ gespeichert → keine Doppelzählung.
  const burned = Math.round(appBurned + (health?.activeKcal ?? 0));
  const remaining = Math.round(goals.kcal - totals.kcal + burned);
  const weekMax = Math.max(1, ...week.map((d) => Math.max(d.kcalIn, d.kcalOut)));

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
    >
      <DateSwitcher date={date} onChange={setDate} />

      <Card>
        <View style={styles.kcalRow}>
          <KcalStat label="Gegessen" value={Math.round(totals.kcal)} color={colors.kcal} />
          <Text style={styles.op}>−</Text>
          <KcalStat label="Verbrannt" value={burned} color={colors.burned} />
          <Text style={styles.op}>=</Text>
          <KcalStat
            label={remaining >= 0 ? 'Übrig' : 'Drüber'}
            value={Math.abs(remaining)}
            color={remaining >= 0 ? colors.primary : colors.danger}
          />
        </View>
        <Text style={styles.hint}>Ziel: {goals.kcal} kcal + verbrannte Kalorien</Text>
      </Card>

      <Card>
        <SectionTitle>Makros</SectionTitle>
        <MacroRow label="Kalorien" value={totals.kcal} goal={goals.kcal} unit="kcal" color={colors.kcal} />
        <MacroRow label="Protein" value={totals.protein} goal={goals.protein} unit="g" color={colors.protein} />
        <MacroRow label="Kohlenhydrate" value={totals.carbs} goal={goals.carbs} unit="g" color={colors.carbs} />
        <MacroRow label="Fett" value={totals.fat} goal={goals.fat} unit="g" color={colors.fat} />
      </Card>

      <Card>
        <SectionTitle>Aktivität</SectionTitle>
        <View style={styles.tiles}>
          <Tile
            icon="footsteps"
            label="Schritte"
            value={health?.steps != null ? health.steps.toLocaleString('de-DE') : '–'}
          />
          <Tile icon="flame" label="Aktiv (Health)" value={health?.activeKcal != null ? `${health.activeKcal}` : '–'} />
          <Tile icon="barbell" label="Einheiten" value={`${activityCount + (health?.sessions.length ?? 0)}`} />
        </View>
        {health?.totalKcal != null && (
          <Text style={styles.hint}>Gesamtumsatz laut {healthName()}: {health.totalKcal} kcal</Text>
        )}
        {!healthOn && (
          <Text style={[styles.hint, { color: colors.primary }]} onPress={() => router.push('/settings')}>
            Mit {healthName()} verbinden, um Schritte & Kalorien deiner Uhr zu sehen →
          </Text>
        )}
      </Card>

      <Card>
        <SectionTitle>Letzte 7 Tage</SectionTitle>
        <View style={styles.chart}>
          {week.map((d) => (
            <View key={d.date} style={styles.chartCol}>
              <View style={styles.bars}>
                <View style={[styles.bar, { height: `${(d.kcalIn / weekMax) * 100}%`, backgroundColor: colors.kcal }]} />
                <View
                  style={[styles.bar, { height: `${(d.kcalOut / weekMax) * 100}%`, backgroundColor: colors.burned }]}
                />
              </View>
              <Text style={[styles.chartLabel, d.date === date && styles.chartLabelActive]}>
                {shortWeekday(d.date)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          <Legend color={colors.kcal} label="Gegessen" />
          <Legend color={colors.burned} label="Verbrannt (App)" />
        </View>
      </Card>
    </ScrollView>
  );
}

function KcalStat({ label, value, color }: { label: string; value: number; color: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

function Tile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  return (
    <View style={styles.tile}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing.lg }}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    kcalRow: { flexDirection: 'row', alignItems: 'center' },
    op: { fontSize: 20, color: c.muted },
    statValue: { fontSize: 24, fontWeight: '800' },
    small: { color: c.muted, fontSize: 12 },
    hint: { color: c.muted, fontSize: 12, marginTop: spacing.sm, textAlign: 'center' },
    tiles: { flexDirection: 'row', justifyContent: 'space-between' },
    tile: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: c.cardAlt,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      marginHorizontal: 4,
    },
    tileValue: { fontSize: 18, fontWeight: '700', color: c.text, marginTop: 4 },
    chart: { flexDirection: 'row', height: 140, alignItems: 'flex-end' },
    chartCol: { flex: 1, alignItems: 'center', height: '100%' },
    bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
    bar: { width: 8, borderRadius: 4, marginHorizontal: 1, minHeight: 2 },
    chartLabel: { fontSize: 11, color: c.muted, marginTop: 4 },
    chartLabelActive: { color: c.primary, fontWeight: '700' },
    legend: { flexDirection: 'row', marginTop: spacing.sm, justifyContent: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  });
