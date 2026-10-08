import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../components/theme';
import { Button, Card, EmptyState, SectionTitle, type IconName } from '../../components/ui';
import { VideoPreview } from '../../components/VideoPreview';
import {
  deleteExercise,
  getExercise,
  getExerciseHistory,
  type Activity,
  type Exercise,
} from '../../db/database';
import { formatDayLabel } from '../../lib/date';
import { deleteStoredVideo } from '../../lib/videos';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);
  const [exercise, setExercise] = useState<Exercise | null | undefined>(undefined);
  const [history, setHistory] = useState<Activity[]>([]);

  useFocusEffect(
    useCallback(() => {
      getExercise(exerciseId).then(setExercise);
      getExerciseHistory(exerciseId).then(setHistory);
    }, [exerciseId])
  );

  if (exercise === undefined) return null;
  if (exercise === null) {
    return <EmptyState icon="alert-circle-outline" text="Diese Übung existiert nicht mehr." />;
  }

  const confirmDelete = () => {
    Alert.alert('Übung löschen?', `„${exercise.name}“ und das Erklärvideo werden gelöscht.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteExercise(exercise.id);
          deleteStoredVideo(exercise.video_uri);
          router.back();
        },
      },
    ]);
  };

  const logWorkout = () =>
    router.push({
      pathname: '/activity/new',
      params: {
        exerciseId: String(exercise.id),
        title: exercise.name,
        type: exercise.muscle_group === 'Cardio' ? 'hiit' : exercise.muscle_group === 'Mobilität' ? 'yoga' : 'strength',
      },
    });

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <Stack.Screen options={{ title: exercise.name }} />

      {exercise.video_uri ? (
        <View style={{ marginBottom: spacing.md }}>
          <VideoPreview key={exercise.video_uri} uri={exercise.video_uri} loop />
        </View>
      ) : (
        <Card style={styles.noVideo}>
          <Ionicons name="videocam-off-outline" size={32} color={colors.muted} />
          <Text style={styles.muted}>Kein Erklärvideo – über „Bearbeiten“ hinzufügen.</Text>
        </Card>
      )}

      <Card>
        <View style={styles.meta}>
          <Meta icon="body" label="Muskelgruppe" value={exercise.muscle_group || '–'} />
          <Meta icon="layers" label="Sätze" value={exercise.sets ? String(exercise.sets) : '–'} />
          <Meta icon="repeat" label="Wdh." value={exercise.reps || '–'} />
        </View>
      </Card>

      {exercise.description ? (
        <Card>
          <SectionTitle>Anleitung</SectionTitle>
          <Text style={styles.description}>{exercise.description}</Text>
        </Card>
      ) : null}

      <Button title="Training erledigt – eintragen" icon="checkmark-done" onPress={logWorkout} />

      <Card>
        <SectionTitle>Verlauf</SectionTitle>
        {history.length === 0 ? (
          <Text style={styles.muted}>Noch nicht trainiert.</Text>
        ) : (
          history.map((h) => (
            <View key={h.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{formatDayLabel(h.date)}</Text>
              <Text style={styles.historyText}>
                {h.duration_min} min · {Math.round(h.kcal)} kcal{h.notes ? ` · ${h.notes}` : ''}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Button
        title="Bearbeiten"
        variant="secondary"
        icon="create"
        onPress={() => router.push({ pathname: '/exercise/new', params: { id: String(exercise.id) } })}
      />
      <Button title="Löschen" variant="danger" icon="trash" onPress={confirmDelete} />
    </ScrollView>
  );
}

function Meta({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  noVideo: { alignItems: 'center', paddingVertical: spacing.xl },
  muted: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
  meta: { flexDirection: 'row' },
  metaValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  description: { fontSize: 15, lineHeight: 22, color: colors.text },
  historyRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  historyDate: { fontWeight: '600', color: colors.text },
  historyText: { color: colors.muted, fontSize: 13 },
});
