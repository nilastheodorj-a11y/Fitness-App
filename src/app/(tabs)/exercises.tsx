import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '../../components/theme';
import { Card, Chip, EmptyState, Fab } from '../../components/ui';
import { getExercises, type Exercise } from '../../db/database';
import { MUSCLE_GROUPS } from '../../lib/muscleGroups';

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getExercises().then(setExercises);
    }, [])
  );

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
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
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
            <Pressable
              key={e.id}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(e.id) } })}
            >
              <Card style={styles.item}>
                <View style={[styles.thumb, e.video_uri ? styles.thumbVideo : null]}>
                  <Ionicons
                    name={e.video_uri ? 'play' : 'barbell'}
                    size={22}
                    color={e.video_uri ? '#fff' : colors.primary}
                  />
                </View>
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
      </ScrollView>
      <Fab onPress={() => router.push('/exercise/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, marginLeft: spacing.sm, fontSize: 16, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  thumbVideo: { backgroundColor: colors.primary },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
