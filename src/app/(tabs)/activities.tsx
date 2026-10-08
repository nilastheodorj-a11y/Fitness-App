import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColors, useStyles } from '../../components/ThemeContext';
import { spacing, type Colors } from '../../components/theme';
import { Card, DateSwitcher, EmptyState, Fab, IconBadge, SectionTitle } from '../../components/ui';
import { deleteActivity, getActivitiesForDate, type Activity } from '../../db/database';
import { fetchDaySummary, healthName, removeActivity, type HealthDaySummary } from '../../health';
import { getActivityType } from '../../lib/activityTypes';
import { todayKey } from '../../lib/date';

export default function ActivitiesScreen() {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const [date, setDate] = useState(todayKey());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [health, setHealth] = useState<HealthDaySummary | null>(null);

  const load = useCallback(async () => {
    setActivities(await getActivitiesForDate(date));
    setHealth(await fetchDaySummary(date));
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmDelete = (a: Activity) => {
    Alert.alert('Aktivität löschen?', a.title, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteActivity(a.id);
          await removeActivity(a);
          load();
        },
      },
    ]);
  };

  const openDetails = (a: Activity) => {
    if (a.workout_id != null) {
      router.push({ pathname: '/workout/[id]', params: { id: String(a.workout_id) } });
    } else if (a.exercise_id != null) {
      router.push({ pathname: '/exercise/[id]', params: { id: String(a.exercise_id) } });
    }
  };

  const totalKcal = Math.round(activities.reduce((s, a) => s + a.kcal, 0));
  const totalMin = activities.reduce((s, a) => s + a.duration_min, 0);
  const sessions = health?.sessions ?? [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <DateSwitcher date={date} onChange={setDate} />

        <Card style={styles.summary}>
          <Stat value={`${totalKcal}`} label="kcal (App)" color={colors.burned} />
          <Stat value={`${totalMin}`} label="Minuten" color={colors.primary} />
          <Stat
            value={health?.activeKcal != null ? `${health.activeKcal}` : '–'}
            label="aktiv (Health)"
            color={colors.kcal}
          />
        </Card>

        <SectionTitle>Deine Einträge</SectionTitle>
        {activities.length === 0 ? (
          <EmptyState icon="flame-outline" text="Noch keine Aktivität an diesem Tag. Tippe auf +, um eine hinzuzufügen." />
        ) : (
          activities.map((a) => {
            const t = getActivityType(a.type);
            return (
              <Pressable key={a.id} onLongPress={() => confirmDelete(a)} onPress={() => openDetails(a)}>
                <Card style={styles.item}>
                  <IconBadge icon={a.workout_id != null ? 'list' : t.icon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{a.title}</Text>
                    <Text style={styles.sub} numberOfLines={2}>
                      {t.label} · {a.duration_min} min{a.notes ? ` · ${a.notes}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.kcal}>{Math.round(a.kcal)} kcal</Text>
                </Card>
              </Pressable>
            );
          })
        )}

        {sessions.length > 0 && (
          <>
            <SectionTitle>Aus {healthName()}</SectionTitle>
            {sessions.map((s) => {
              const t = getActivityType(s.activityType);
              return (
                <Card key={s.id} style={styles.item}>
                  <IconBadge icon={t.icon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{s.title}</Text>
                    <Text style={styles.sub}>
                      {new Date(s.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {s.durationMin} min
                    </Text>
                  </View>
                  {s.kcal != null ? (
                    <Text style={styles.kcal}>{s.kcal} kcal</Text>
                  ) : (
                    <Ionicons name="heart-circle" size={20} color={colors.muted} />
                  )}
                </Card>
              );
            })}
            <Text style={styles.tip}>
              Kalorien dieser Trainings stecken bereits in „aktiv (Health)“.
            </Text>
          </>
        )}
      </ScrollView>
      <Fab onPress={() => router.push({ pathname: '/activity/new', params: { date } })} />
    </View>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    summary: { flexDirection: 'row' },
    statValue: { fontSize: 22, fontWeight: '800' },
    statLabel: { fontSize: 12, color: c.muted },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
    title: { fontSize: 16, fontWeight: '600', color: c.text },
    sub: { fontSize: 12, color: c.muted, marginTop: 2 },
    kcal: { fontWeight: '700', color: c.burned },
    tip: { textAlign: 'center', color: c.muted, fontSize: 12, marginBottom: spacing.md },
  });
