import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useColors, useStyles } from '../../components/ThemeContext';
import { radius, spacing, type Colors } from '../../components/theme';
import { Button, Card, parseNumber, SmallInput } from '../../components/ui';
import { VideoPreview } from '../../components/VideoPreview';
import {
  addActivity,
  addSetLogs,
  getBodyWeight,
  getLastSets,
  getWorkout,
  getWorkoutItems,
  type Workout,
  type WorkoutItemWithExercise,
} from '../../db/database';
import { syncActivity } from '../../health';
import { estimateKcal } from '../../lib/activityTypes';
import { todayKey } from '../../lib/date';
import { formatDuration } from '../../lib/format';

type SetState = { reps: string; weight: string; done: boolean };

function defaultReps(reps: string): string {
  const n = parseInt(reps, 10);
  return Number.isFinite(n) ? String(n) : '';
}

export default function WorkoutSessionScreen() {
  useKeepAwake();
  const styles = useStyles(createStyles);
  const colors = useColors();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [items, setItems] = useState<WorkoutItemWithExercise[]>([]);
  const [sets, setSets] = useState<SetState[][]>([]);
  const [current, setCurrent] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const finished = useRef(false);

  // Plan laden und Gewichte/Wiederholungen der letzten Einheit vorausfüllen
  useEffect(() => {
    const id = Number(workoutId);
    (async () => {
      const [w, its] = await Promise.all([getWorkout(id), getWorkoutItems(id)]);
      setWorkout(w);
      setItems(its);
      const initial = await Promise.all(
        its.map(async (item) => {
          const last = await getLastSets(item.exercise_id);
          return Array.from({ length: item.sets }, (_, i) => {
            const prev = last[i] ?? last[last.length - 1];
            return {
              reps: prev ? String(prev.reps) : defaultReps(item.reps),
              weight: prev && prev.weight > 0 ? String(prev.weight).replace('.', ',') : '',
              done: false,
            };
          });
        })
      );
      setSets(initial);
    })();
  }, [workoutId]);

  // Uhr für Trainingsdauer und Pausen-Timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const restLeft = restUntil ? Math.ceil((restUntil - now) / 1000) : 0;
  useEffect(() => {
    if (restUntil && restLeft <= 0) {
      setRestUntil(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [restUntil, restLeft]);

  const totalSets = sets.reduce((s, x) => s + x.length, 0);
  const doneSets = sets.reduce((s, x) => s + x.filter((y) => y.done).length, 0);

  const confirmCancel = useCallback(() => {
    if (finished.current) return false;
    Alert.alert('Training abbrechen?', 'Deine eingetragenen Sätze werden nicht gespeichert.', [
      { text: 'Weiter trainieren', style: 'cancel' },
      {
        text: 'Abbrechen',
        style: 'destructive',
        onPress: () => {
          finished.current = true;
          router.back();
        },
      },
    ]);
    return true;
  }, []);

  // Android-Zurück-Taste nicht aus Versehen das Training beenden lassen
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', confirmCancel);
    return () => sub.remove();
  }, [confirmCancel]);

  const updateSet = (exIndex: number, setIndex: number, patch: Partial<SetState>) =>
    setSets((prev) =>
      prev.map((row, i) => (i === exIndex ? row.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)) : row))
    );

  const toggleDone = (setIndex: number) => {
    const wasDone = sets[current]?.[setIndex]?.done;
    updateSet(current, setIndex, { done: !wasDone });
    if (!wasDone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const item = items[current];
      const isVeryLast = current === items.length - 1 && setIndex === (sets[current]?.length ?? 0) - 1;
      if (item && item.rest_sec > 0 && !isVeryLast) setRestUntil(Date.now() + item.rest_sec * 1000);
    }
  };

  const addSet = () =>
    setSets((prev) =>
      prev.map((row, i) => {
        if (i !== current) return row;
        const last = row[row.length - 1];
        return [...row, { reps: last?.reps ?? '', weight: last?.weight ?? '', done: false }];
      })
    );

  const finish = async () => {
    setSaving(true);
    try {
      const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const weight = await getBodyWeight();
      const activity = await addActivity({
        date: todayKey(),
        type: 'strength',
        title: workout?.name ?? 'Training',
        duration_min: minutes,
        kcal: estimateKcal('strength', minutes, weight),
        notes: `${doneSets}/${totalSets} Sätze`,
        exercise_id: null,
        workout_id: workout?.id ?? null,
      });
      const logs = sets.flatMap((row, i) =>
        row
          .map((s, j) => ({ s, j }))
          .filter(({ s }) => s.done)
          .map(({ s, j }) => ({
            exercise_id: items[i].exercise_id,
            set_index: j,
            reps: Math.round(parseNumber(s.reps)),
            weight: parseNumber(s.weight),
          }))
      );
      await addSetLogs(activity.id, logs);
      await syncActivity(activity);
      finished.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Starke Leistung! 💪', `${doneSets} Sätze in ${minutes} Minuten · ca. ${activity.kcal} kcal`);
      router.back();
    } catch (e) {
      Alert.alert('Fehler beim Speichern', String(e));
      setSaving(false);
    }
  };

  const confirmFinish = () => {
    if (doneSets === 0) {
      Alert.alert('Noch keine Sätze erledigt', 'Hake mindestens einen Satz ab, bevor du das Training beendest.');
      return;
    }
    if (doneSets < totalSets) {
      Alert.alert('Training beenden?', `Du hast ${doneSets} von ${totalSets} Sätzen erledigt.`, [
        { text: 'Weiter trainieren', style: 'cancel' },
        { text: 'Beenden & speichern', onPress: finish },
      ]);
    } else {
      finish();
    }
  };

  const item = items[current];
  const rows = sets[current] ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: formatDuration((now - startedAt) / 1000),
          headerLeft: () => (
            <Pressable onPress={confirmCancel} hitSlop={10} accessibilityLabel="Training abbrechen">
              <Ionicons name="close" size={26} color={colors.primary} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={confirmFinish} hitSlop={10} disabled={saving}>
              <Text style={styles.headerAction}>Fertig</Text>
            </Pressable>
          ),
        }}
      />

      {restUntil && (
        <View style={styles.rest}>
          <Ionicons name="timer-outline" size={22} color={colors.onPrimary} />
          <Text style={styles.restText}>Pause {formatDuration(restLeft)}</Text>
          <Pressable style={styles.restButton} onPress={() => setRestUntil((r) => (r ? r + 15000 : r))}>
            <Text style={styles.restButtonText}>+15 s</Text>
          </Pressable>
          <Pressable style={styles.restButton} onPress={() => setRestUntil(null)}>
            <Text style={styles.restButtonText}>Weiter</Text>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {items.map((it, i) => {
            const allDone = (sets[i] ?? []).length > 0 && (sets[i] ?? []).every((s) => s.done);
            return (
              <Pressable
                key={it.id}
                onPress={() => setCurrent(i)}
                style={[styles.step, i === current && styles.stepActive, allDone && styles.stepDone]}
              >
                {allDone && <Ionicons name="checkmark" size={14} color={colors.onPrimary} style={{ marginRight: 4 }} />}
                <Text style={[styles.stepText, (i === current || allDone) && styles.stepTextActive]} numberOfLines={1}>
                  {i + 1}. {it.exercise_name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {item && (
          <>
            <Text style={styles.exerciseName}>{item.exercise_name}</Text>
            <Text style={styles.target}>
              Ziel: {item.sets} × {item.reps} · {item.rest_sec} s Pause
            </Text>

            {item.video_uri ? (
              <View style={{ marginVertical: spacing.md }}>
                <VideoPreview key={item.video_uri} uri={item.video_uri} loop />
              </View>
            ) : null}

            {item.description ? (
              <Pressable onPress={() => setShowInfo((s) => !s)} style={styles.infoToggle}>
                <Ionicons name={showInfo ? 'chevron-up' : 'information-circle-outline'} size={18} color={colors.primary} />
                <Text style={styles.infoToggleText}>{showInfo ? 'Anleitung ausblenden' : 'Anleitung anzeigen'}</Text>
              </Pressable>
            ) : null}
            {showInfo && item.description ? (
              <Card>
                <Text style={styles.description}>{item.description}</Text>
              </Card>
            ) : null}

            <Card>
              <View style={styles.setHeader}>
                <Text style={[styles.colLabel, styles.colSet]}>Satz</Text>
                <Text style={[styles.colLabel, styles.colInput]}>kg</Text>
                <Text style={[styles.colLabel, styles.colInput]}>Wdh.</Text>
                <View style={styles.colCheck} />
              </View>
              {rows.map((s, j) => (
                <View key={j} style={[styles.setRow, s.done && styles.setRowDone]}>
                  <Text style={[styles.setNumber, styles.colSet]}>{j + 1}</Text>
                  <View style={styles.colInput}>
                    <SmallInput
                      value={s.weight}
                      placeholder="–"
                      onChangeText={(t) => updateSet(current, j, { weight: t })}
                    />
                  </View>
                  <View style={styles.colInput}>
                    <SmallInput
                      value={s.reps}
                      placeholder="–"
                      keyboardType="number-pad"
                      onChangeText={(t) => updateSet(current, j, { reps: t })}
                    />
                  </View>
                  <Pressable style={styles.colCheck} onPress={() => toggleDone(j)} hitSlop={6}>
                    <Ionicons
                      name={s.done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={32}
                      color={s.done ? colors.success : colors.muted}
                    />
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={addSet} style={styles.addSet}>
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={styles.addSetText}>Satz hinzufügen</Text>
              </Pressable>
            </Card>

            <View style={styles.nav}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Zurück"
                  variant="secondary"
                  icon="chevron-back"
                  disabled={current === 0}
                  onPress={() => setCurrent((c) => Math.max(0, c - 1))}
                />
              </View>
              <View style={{ width: spacing.sm }} />
              <View style={{ flex: 1 }}>
                {current < items.length - 1 ? (
                  <Button title="Nächste" icon="chevron-forward" onPress={() => setCurrent((c) => c + 1)} />
                ) : (
                  <Button title="Abschließen" icon="flag" onPress={confirmFinish} loading={saving} />
                )}
              </View>
            </View>
            <Text style={styles.progress}>
              {doneSets} von {totalSets} Sätzen erledigt
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    headerAction: { color: c.primary, fontSize: 17, fontWeight: '600' },
    rest: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    restText: { color: c.onPrimary, fontSize: 18, fontWeight: '700', flex: 1, marginLeft: spacing.sm },
    restButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.sm,
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginLeft: spacing.sm,
    },
    restButtonText: { color: c.onPrimary, fontWeight: '600' },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      marginRight: spacing.sm,
      maxWidth: 200,
    },
    stepActive: { borderColor: c.primary, backgroundColor: c.primary },
    stepDone: { borderColor: c.success, backgroundColor: c.success },
    stepText: { color: c.text, fontSize: 13 },
    stepTextActive: { color: c.onPrimary, fontWeight: '600' },
    exerciseName: { fontSize: 24, fontWeight: '800', color: c.text },
    target: { color: c.muted, marginTop: 2 },
    infoToggle: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.sm },
    infoToggleText: { color: c.primary, marginLeft: 6, fontWeight: '600' },
    description: { color: c.text, lineHeight: 21 },
    setHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
    colLabel: { color: c.muted, fontSize: 12, textAlign: 'center' },
    colSet: { width: 40 },
    colInput: { flex: 1, marginHorizontal: spacing.xs },
    colCheck: { width: 44, alignItems: 'center' },
    setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderRadius: radius.sm },
    setRowDone: { backgroundColor: c.cardAlt },
    setNumber: { textAlign: 'center', fontWeight: '700', color: c.text, fontSize: 16 },
    addSet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: spacing.md },
    addSetText: { color: c.primary, fontWeight: '600', marginLeft: 4 },
    nav: { flexDirection: 'row' },
    progress: { color: c.muted, textAlign: 'center', marginTop: spacing.xs },
  });
