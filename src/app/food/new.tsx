import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../components/theme';
import { Button, Card, Chip, Field, parseNumber, SectionTitle } from '../../components/ui';
import {
  addFood,
  getRecentFoods,
  MEAL_LABELS,
  type FoodEntry,
  type MealType,
} from '../../db/database';
import { writeFood } from '../../health/healthConnect';
import { todayKey } from '../../lib/date';

const MEALS = Object.keys(MEAL_LABELS) as MealType[];

function defaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export default function NewFoodScreen() {
  const params = useLocalSearchParams<{ meal?: MealType; date?: string }>();
  const date = params.date ?? todayKey();

  const [meal, setMeal] = useState<MealType>(params.meal ?? defaultMeal());
  const [name, setName] = useState('');
  const [per100, setPer100] = useState(false);
  const [amount, setAmount] = useState('100');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [recent, setRecent] = useState<FoodEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRecentFoods().then(setRecent);
  }, []);

  const factor = per100 ? parseNumber(amount) / 100 : 1;
  const p = parseNumber(protein) * factor;
  const c = parseNumber(carbs) * factor;
  const f = parseNumber(fat) * factor;
  // Wenn keine Kalorien angegeben sind, aus den Makros berechnen (4/4/9 kcal pro g)
  const k = kcal.trim() ? parseNumber(kcal) * factor : p * 4 + c * 4 + f * 9;

  const fillFrom = (food: FoodEntry) => {
    setName(food.name);
    setPer100(false);
    setKcal(String(Math.round(food.kcal)));
    setProtein(String(Math.round(food.protein * 10) / 10));
    setCarbs(String(Math.round(food.carbs * 10) / 10));
    setFat(String(Math.round(food.fat * 10) / 10));
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Bitte gib einen Namen ein.');
      return;
    }
    setSaving(true);
    try {
      const entry = {
        date,
        meal,
        name: per100 ? `${name.trim()} (${parseNumber(amount)} g)` : name.trim(),
        kcal: Math.round(k),
        protein: Math.round(p * 10) / 10,
        carbs: Math.round(c * 10) / 10,
        fat: Math.round(f * 10) / 10,
      };
      const id = await addFood(entry);
      await writeFood({ ...entry, id, created_at: new Date().toISOString() });
      router.back();
    } catch (e) {
      Alert.alert('Fehler beim Speichern', String(e));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View style={styles.chips}>
          {MEALS.map((m) => (
            <Chip key={m} label={MEAL_LABELS[m]} selected={meal === m} onPress={() => setMeal(m)} />
          ))}
        </View>

        <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Haferflocken" />

        <View style={styles.chips}>
          <Chip label="Pro Portion" selected={!per100} onPress={() => setPer100(false)} />
          <Chip label="Pro 100 g" selected={per100} onPress={() => setPer100(true)} />
        </View>
        {per100 && (
          <Field label="Menge (g)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        )}

        <Field
          label={per100 ? 'Kalorien pro 100 g (leer = aus Makros)' : 'Kalorien (leer = aus Makros)'}
          value={kcal}
          onChangeText={setKcal}
          keyboardType="decimal-pad"
          placeholder="kcal"
        />
        <View style={styles.row}>
          <Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
          <View style={{ width: spacing.sm }} />
          <Field label="Kohlenh. (g)" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
          <View style={{ width: spacing.sm }} />
          <Field label="Fett (g)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
        </View>

        <Card style={styles.total}>
          <Text style={styles.totalText}>
            {Math.round(k)} kcal · P {Math.round(p)} g · K {Math.round(c)} g · F {Math.round(f)} g
          </Text>
        </Card>

        <Button title="Speichern" icon="checkmark" onPress={save} loading={saving} />

        {recent.length > 0 && (
          <>
            <SectionTitle>Zuletzt verwendet</SectionTitle>
            <View style={styles.chips}>
              {recent.map((r) => (
                <Chip key={r.id} label={r.name} selected={false} onPress={() => fillFrom(r)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  row: { flexDirection: 'row' },
  total: { alignItems: 'center' },
  totalText: { fontWeight: '600', color: colors.text },
});
