import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColors, useStyles } from '../../components/ThemeContext';
import { spacing, type Colors } from '../../components/theme';
import { Button, Card, EmptyState, SectionTitle, type IconName } from '../../components/ui';
import { VideoPreview } from '../../components/VideoPreview';
import {
  deleteExercise,
  getExercise,
  getExerciseHistory,
  type Exercise,
  type ExerciseHistoryEntry,
} from '../../db/database';
import { formatDayLabel } from '../../lib/date';
import { formatSets } from '../../lib/format';
import { deleteStoredVideo } from '../../lib/videos';

export default function ExerciseDetailScreen() {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);
  const [exercise, setExercise] = useState<Exercise | null | undefined>(undefined);
  const [history, setHistory] = useState<ExerciseHistoryEntry[]>([]);

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
    Alert.alert(
      'Übung löschen?',
      `„${exercise.name}“ und das Erklärvideo werden gelöscht. Sie wird auch aus allen Trainingsplänen entfernt.`,
      [
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
      ]
    );
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
              <Text style={styles.historyDate}>
                {formatDayLabel(h.date)}
                {h.workout_id != null ? <Text style={styles.historyPlan}> · {h.title}</Text> : null}
              </Text>
              <Text style={styles.historyText}>
                {h.sets.length > 0
                  ? formatSets(h.sets)
                  : `${h.duration_min} min · ${Math.round(h.kcal)} kcal${h.notes ? ` · ${h.notes}` : ''}`}
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

function Meta({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    noVideo: { alignItems: 'center', paddingVertical: spacing.xl },
    muted: { color: c.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
    meta: { flexDirection: 'row' },
    metaValue: { fontSize: 16, fontWeight: '700', color: c.text, marginTop: 4 },
    description: { fontSize: 15, lineHeight: 22, color: c.text },
    historyRow: {
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    historyDate: { fontWeight: '600', color: c.text },
    historyPlan: { fontWeight: '400', color: c.muted },
    historyText: { color: c.muted, fontSize: 13, marginTop: 2 },
  });
