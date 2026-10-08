import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColors, useStyles } from '../../components/ThemeContext';
import { spacing, type Colors } from '../../components/theme';
import { Button, Card, EmptyState, IconBadge, SectionTitle } from '../../components/ui';
import {
  deleteWorkout,
  getWorkout,
  getWorkoutHistory,
  getWorkoutItems,
  type Activity,
  type Workout,
  type WorkoutItemWithExercise,
} from '../../db/database';
import { formatDayLabel } from '../../lib/date';

export default function WorkoutDetailScreen() {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  const [items, setItems] = useState<WorkoutItemWithExercise[]>([]);
  const [history, setHistory] = useState<Activity[]>([]);

  useFocusEffect(
    useCallback(() => {
      getWorkout(workoutId).then(setWorkout);
      getWorkoutItems(workoutId).then(setItems);
      getWorkoutHistory(workoutId).then(setHistory);
    }, [workoutId])
  );

  if (workout === undefined) return null;
  if (workout === null) return <EmptyState icon="alert-circle-outline" text="Dieser Plan existiert nicht mehr." />;

  const totalSets = items.reduce((s, i) => s + i.sets, 0);

  const confirmDelete = () =>
    Alert.alert('Plan löschen?', `„${workout.name}“ wird gelöscht. Die Übungen und dein Verlauf bleiben erhalten.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(workout.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <Stack.Screen options={{ title: workout.name }} />

      <Card>
        <Text style={styles.summary}>
          {items.length} Übungen · {totalSets} Sätze
        </Text>
        {workout.notes ? <Text style={styles.notes}>{workout.notes}</Text> : null}
      </Card>

      <Button
        title="Training starten"
        icon="play"
        disabled={items.length === 0}
        onPress={() => router.push({ pathname: '/workout/session', params: { workoutId: String(workout.id) } })}
      />

      <SectionTitle>Ablauf</SectionTitle>
      {items.map((item, index) => (
        <Pressable
          key={item.id}
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(item.exercise_id) } })}
        >
          <Card style={styles.item}>
            <IconBadge icon={item.video_uri ? 'play' : 'barbell'} filled={!!item.video_uri} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {index + 1}. {item.exercise_name}
              </Text>
              <Text style={styles.sub}>
                {item.sets} × {item.reps} · {item.rest_sec} s Pause
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Card>
        </Pressable>
      ))}

      <Card>
        <SectionTitle>Verlauf</SectionTitle>
        {history.length === 0 ? (
          <Text style={styles.sub}>Noch nicht absolviert.</Text>
        ) : (
          history.map((h) => (
            <View key={h.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{formatDayLabel(h.date)}</Text>
              <Text style={styles.sub}>
                {h.duration_min} min · {Math.round(h.kcal)} kcal
              </Text>
            </View>
          ))
        )}
      </Card>

      <Button
        title="Plan bearbeiten"
        variant="secondary"
        icon="create"
        onPress={() => router.push({ pathname: '/workout/edit', params: { id: String(workout.id) } })}
      />
      <Button title="Plan löschen" variant="danger" icon="trash" onPress={confirmDelete} />
    </ScrollView>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    summary: { color: c.text, fontSize: 16, fontWeight: '600' },
    notes: { color: c.muted, marginTop: spacing.sm },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
    name: { fontSize: 16, fontWeight: '600', color: c.text },
    sub: { fontSize: 12, color: c.muted, marginTop: 2 },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    historyDate: { fontWeight: '600', color: c.text },
  });
