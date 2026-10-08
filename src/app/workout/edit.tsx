import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
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
import { Button, Card, EmptyState, Field, parseNumber, SectionTitle, SmallInput } from '../../components/ui';
import {
  getExercises,
  getWorkout,
  getWorkoutItems,
  saveWorkout,
  type Exercise,
} from '../../db/database';

type DraftItem = {
  key: string;
  exercise_id: number;
  name: string;
  sets: string;
  reps: string;
  rest: string;
};

let keyCounter = 0;
const nextKey = () => `item-${keyCounter++}`;

/** Trainingsplan anlegen oder (mit ?id=) bearbeiten. */
export default function WorkoutEditScreen() {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getExercises().then((ex) => {
      setLibrary(ex);
      if (editId == null && ex.length > 0) setPicking(true);
    });
    if (editId == null) return;
    Promise.all([getWorkout(editId), getWorkoutItems(editId)]).then(([w, its]) => {
      if (!w) return;
      setName(w.name);
      setNotes(w.notes);
      setItems(
        its.map((i) => ({
          key: nextKey(),
          exercise_id: i.exercise_id,
          name: i.exercise_name,
          sets: String(i.sets),
          reps: i.reps,
          rest: String(i.rest_sec),
        }))
      );
    });
  }, [editId]);

  const addExercise = (e: Exercise) => {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        exercise_id: e.id,
        name: e.name,
        sets: String(e.sets ?? 3),
        reps: e.reps || '10',
        rest: '90',
      },
    ]);
  };

  const update = (key: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const move = (index: number, dir: -1 | 1) =>
    setItems((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const remove = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Bitte gib dem Plan einen Namen.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Füge mindestens eine Übung hinzu.');
      return;
    }
    setSaving(true);
    try {
      await saveWorkout(
        { id: editId ?? undefined, name: name.trim(), notes: notes.trim() },
        items.map((i) => ({
          exercise_id: i.exercise_id,
          sets: Math.max(1, Math.round(parseNumber(i.sets)) || 1),
          reps: i.reps.trim() || '10',
          rest_sec: Math.max(0, Math.round(parseNumber(i.rest))),
        }))
      );
      router.back();
    } catch (e) {
      Alert.alert('Fehler beim Speichern', String(e));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editId != null ? 'Plan bearbeiten' : 'Neuer Trainingsplan' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Push Day, Ganzkörper A" />
        <Field label="Notizen (optional)" value={notes} onChangeText={setNotes} placeholder="z. B. Aufwärmen nicht vergessen" />

        <SectionTitle>Übungen</SectionTitle>
        {items.length === 0 && <Text style={styles.muted}>Noch keine Übungen im Plan.</Text>}
        {items.map((item, index) => (
          <Card key={item.key} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemIndex}>{index + 1}</Text>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Pressable hitSlop={8} onPress={() => move(index, -1)} disabled={index === 0}>
                <Ionicons name="arrow-up" size={20} color={index === 0 ? colors.border : colors.muted} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => move(index, 1)} disabled={index === items.length - 1}>
                <Ionicons
                  name="arrow-down"
                  size={20}
                  color={index === items.length - 1 ? colors.border : colors.muted}
                  style={{ marginHorizontal: spacing.sm }}
                />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => remove(item.key)}>
                <Ionicons name="close-circle" size={22} color={colors.danger} />
              </Pressable>
            </View>
            <View style={styles.params}>
              <Param label="Sätze">
                <SmallInput value={item.sets} onChangeText={(t) => update(item.key, { sets: t })} keyboardType="number-pad" />
              </Param>
              <Param label="Wdh.">
                <SmallInput
                  value={item.reps}
                  onChangeText={(t) => update(item.key, { reps: t })}
                  keyboardType="default"
                />
              </Param>
              <Param label="Pause (s)">
                <SmallInput value={item.rest} onChangeText={(t) => update(item.key, { rest: t })} keyboardType="number-pad" />
              </Param>
            </View>
          </Card>
        ))}

        <Button
          title={picking ? 'Auswahl schließen' : 'Übung hinzufügen'}
          variant="secondary"
          icon={picking ? 'chevron-up' : 'add'}
          onPress={() => setPicking((p) => !p)}
        />

        {picking &&
          (library.length === 0 ? (
            <EmptyState icon="barbell-outline" text="Du hast noch keine Übungen. Lege sie im Tab „Training“ › „Übungen“ an." />
          ) : (
            <Card>
              {library.map((e) => {
                const count = items.filter((i) => i.exercise_id === e.id).length;
                return (
                  <Pressable key={e.id} style={styles.pickRow} onPress={() => addExercise(e)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickName}>{e.name}</Text>
                      {e.muscle_group ? <Text style={styles.muted}>{e.muscle_group}</Text> : null}
                    </View>
                    {count > 0 && <Text style={styles.count}>{count}×</Text>}
                    <Ionicons name="add-circle" size={26} color={colors.primary} />
                  </Pressable>
                );
              })}
            </Card>
          ))}

        <View style={{ height: spacing.md }} />
        <Button title="Plan speichern" icon="checkmark" onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Param({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.param}>
      <Text style={styles.paramLabel}>{label}</Text>
      {children}
    </View>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    muted: { color: c.muted, fontSize: 12 },
    itemCard: { paddingVertical: spacing.md },
    itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    itemIndex: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      color: c.primary,
      textAlign: 'center',
      lineHeight: 24,
      fontWeight: '700',
      marginRight: spacing.sm,
      overflow: 'hidden',
    },
    itemName: { flex: 1, fontSize: 16, fontWeight: '600', color: c.text },
    params: { flexDirection: 'row' },
    param: { flex: 1, marginRight: spacing.sm },
    paramLabel: { color: c.muted, fontSize: 12, marginBottom: 4 },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      borderRadius: radius.sm,
    },
    pickName: { color: c.text, fontSize: 16 },
    count: { color: c.primary, fontWeight: '700', marginRight: spacing.sm },
  });
