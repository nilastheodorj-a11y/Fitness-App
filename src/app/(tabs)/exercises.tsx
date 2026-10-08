import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useColors, useStyles } from '../../components/ThemeContext';
import { radius, spacing, type Colors } from '../../components/theme';
import { Card, Chip, EmptyState, Fab, IconBadge, Segmented } from '../../components/ui';
import { getExercises, getWorkouts, type Exercise, type WorkoutSummary } from '../../db/database';
import { formatDayLabel } from '../../lib/date';
import { MUSCLE_GROUPS } from '../../lib/muscleGroups';

type Tab = 'plans' | 'exercises';

export default function TrainingScreen() {
  const [tab, setTab] = useState<Tab>('plans');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      getExercises().then(setExercises);
      getWorkouts().then(setWorkouts);
    }, [])
  );

  const onAdd = () => {
    if (tab === 'plans') router.push('/workout/edit');
    else router.push('/exercise/new');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'plans', label: `Pläne (${workouts.length})` },
            { value: 'exercises', label: `Übungen (${exercises.length})` },
          ]}
        />
        {tab === 'plans' ? (
          <PlanList workouts={workouts} hasExercises={exercises.length > 0} />
        ) : (
          <ExerciseList exercises={exercises} />
        )}
      </ScrollView>
      <Fab onPress={onAdd} />
    </View>
  );
}

function PlanList({ workouts, hasExercises }: { workouts: WorkoutSummary[]; hasExercises: boolean }) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  if (workouts.length === 0) {
    return (
      <EmptyState
        icon="list-outline"
        text={
          hasExercises
            ? 'Noch keine Trainingspläne. Tippe auf +, um Übungen zu einem Plan zusammenzustellen.'
            : 'Lege zuerst unter „Übungen“ ein paar Übungen an – dann kannst du sie hier zu Plänen kombinieren.'
        }
      />
    );
  }
  return (
    <>
      {workouts.map((w) => (
        <Pressable key={w.id} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(w.id) } })}>
          <Card style={styles.item}>
            <IconBadge icon="list" filled />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{w.name}</Text>
              <Text style={styles.sub}>
                {w.exercise_count} {w.exercise_count === 1 ? 'Übung' : 'Übungen'}
                {w.last_done ? ` · zuletzt ${formatDayLabel(w.last_done)}` : ''}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={() => router.push({ pathname: '/workout/session', params: { workoutId: String(w.id) } })}
              accessibilityLabel={`${w.name} starten`}
            >
              <Ionicons name="play-circle" size={36} color={colors.primary} />
            </Pressable>
          </Card>
        </Pressable>
      ))}
    </>
  );
}

function ExerciseList({ exercises }: { exercises: Exercise[] }) {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (!group || e.muscle_group === group) &&
        (!q || e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
    );
  }, [exercises, query, group]);

  const usedGroups = MUSCLE_GROUPS.filter((g) => exercises.some((e) => e.muscle_group === g));

  return (
    <>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Übung suchen"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {usedGroups.length > 0 && (
        <View style={styles.chips}>
          <Chip label="Alle" selected={group === null} onPress={() => setGroup(null)} />
          {usedGroups.map((g) => (
            <Chip key={g} label={g} selected={group === g} onPress={() => setGroup(g)} />
          ))}
        </View>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon="videocam-outline"
          text={
            exercises.length === 0
              ? 'Noch keine Übungen. Tippe auf +, um eine Übung mit Erklärvideo anzulegen.'
              : 'Keine Übung gefunden.'
          }
        />
      ) : (
        filtered.map((e) => (
          <Pressable key={e.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(e.id) } })}>
            <Card style={styles.item}>
              <IconBadge icon={e.video_uri ? 'play' : 'barbell'} filled={!!e.video_uri} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{e.name}</Text>
                <Text style={styles.sub}>
                  {[e.muscle_group, e.sets ? `${e.sets} Sätze` : null, e.reps ? `${e.reps} Wdh.` : null]
                    .filter(Boolean)
                    .join(' · ') || 'Keine Details'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Card>
          </Pressable>
        ))
      )}
    </>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: { flex: 1, paddingVertical: 10, marginLeft: spacing.sm, fontSize: 16, color: c.text },
    chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
    name: { fontSize: 16, fontWeight: '600', color: c.text },
    sub: { fontSize: 12, color: c.muted, marginTop: 2 },
  });
