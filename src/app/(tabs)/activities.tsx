import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../components/theme';
import { Card, DateSwitcher, EmptyState, Fab, SectionTitle, type IconName } from '../../components/ui';
import { deleteActivity, getActivitiesForDate, type Activity } from '../../db/database';
import {
  deleteActivityRecord,
  fetchDaySummary,
  type HealthDaySummary,
} from '../../health/healthConnect';
import { activityTypeFromHealthConnect, getActivityType } from '../../lib/activityTypes';
import { todayKey } from '../../lib/date';

export default function ActivitiesScreen() {
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
          await deleteActivityRecord(a.id);
          load();
        },
      },
    ]);
  };

  const totalKcal = Math.round(activities.reduce((s, a) => s + a.kcal, 0));
  const totalMin = activities.reduce((s, a) => s + a.duration_min, 0);
  const hcSessions = health?.sessions ?? [];

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
              <Pressable
                key={a.id}
                onLongPress={() => confirmDelete(a)}
                onPress={() =>
                  a.exercise_id != null &&
                  router.push({ pathname: '/exercise/[id]', params: { id: String(a.exercise_id) } })
                }
              >
                <Card style={styles.item}>
                  <ActivityIcon icon={t.icon as IconName} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{a.title}</Text>
                    <Text style={styles.sub}>
                      {t.label} · {a.duration_min} min{a.notes ? ` · ${a.notes}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.kcal}>{Math.round(a.kcal)} kcal</Text>
                </Card>
              </Pressable>
            );
          })
        )}

        {hcSessions.length > 0 && (
          <>
            <SectionTitle>Aus Health Connect</SectionTitle>
            {hcSessions.map((s) => {
              const t = activityTypeFromHealthConnect(s.exerciseType);
              return (
                <Card key={s.id} style={styles.item}>
                  <ActivityIcon icon={t.icon as IconName} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{s.title || t.label}</Text>
                    <Text style={styles.sub}>
                      {new Date(s.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {s.durationMin} min
                    </Text>
                  </View>
                  <Ionicons name="heart-circle" size={20} color={colors.muted} />
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
      <Fab onPress={() => router.push({ pathname: '/activity/new', params: { date } })} />
    </View>
  );
}

function ActivityIcon({ icon }: { icon: IconName }) {
  return (
    <View style={styles.icon}>
      <Ionicons name={icon} size={22} color={colors.primary} />
    </View>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  kcal: { fontWeight: '700', color: colors.burned },
});
