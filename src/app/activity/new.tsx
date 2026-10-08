import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../components/theme';
import { Button, Chip, Field, parseNumber, type IconName } from '../../components/ui';
import { addActivity, getSetting } from '../../db/database';
import { writeActivity } from '../../health/healthConnect';
import { ACTIVITY_TYPES, estimateKcal, getActivityType } from '../../lib/activityTypes';
import { todayKey } from '../../lib/date';

export default function NewActivityScreen() {
  const params = useLocalSearchParams<{
    date?: string;
    exerciseId?: string;
    title?: string;
    type?: string;
  }>();
  const date = params.date ?? todayKey();
  const exerciseId = params.exerciseId ? Number(params.exerciseId) : null;

  const [type, setType] = useState(params.type ?? 'strength');
  const [title, setTitle] = useState(params.title ?? '');
  const [duration, setDuration] = useState('30');
  const [kcal, setKcal] = useState('');
  const [notes, setNotes] = useState('');
  const [weight, setWeight] = useState(75);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting('weightKg').then((w) => w && setWeight(parseNumber(w) || 75));
  }, []);

  const estimated = estimateKcal(type, parseNumber(duration), weight);

  const save = async () => {
    const minutes = Math.round(parseNumber(duration));
    if (minutes <= 0) {
      Alert.alert('Bitte gib eine Dauer in Minuten an.');
      return;
    }
    setSaving(true);
    try {
      const activity = {
        date,
        type,
        title: title.trim() || getActivityType(type).label,
        duration_min: minutes,
        kcal: kcal.trim() ? Math.round(parseNumber(kcal)) : estimated,
        notes: notes.trim(),
        exercise_id: exerciseId,
      };
      const id = await addActivity(activity);
      await writeActivity({ ...activity, id, created_at: new Date().toISOString() });
      router.back();
    } catch (e) {
      Alert.alert('Fehler beim Speichern', String(e));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Art</Text>
        <View style={styles.chips}>
          {ACTIVITY_TYPES.map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              icon={t.icon as IconName}
              selected={type === t.key}
              onPress={() => setType(t.key)}
            />
          ))}
        </View>

        <Field
          label="Titel (optional)"
          value={title}
          onChangeText={setTitle}
          placeholder={getActivityType(type).label}
        />
        <View style={{ flexDirection: 'row' }}>
          <Field label="Dauer (Minuten)" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
          <View style={{ width: spacing.sm }} />
          <Field
            label="Verbrannte kcal"
            value={kcal}
            onChangeText={setKcal}
            keyboardType="number-pad"
            placeholder={`≈ ${estimated}`}
          />
        </View>
        <Text style={styles.hint}>
          Leer lassen für eine Schätzung ({estimated} kcal bei {weight} kg Körpergewicht).
        </Text>
        <Field
          label="Notizen"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="z. B. 4×10 mit 60 kg"
        />

        <Button title="Speichern" icon="checkmark" onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, marginBottom: 6, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  hint: { color: colors.muted, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md },
});
