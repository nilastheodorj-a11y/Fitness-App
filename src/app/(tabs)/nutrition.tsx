import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../components/theme';
import { Card, DateSwitcher, SectionTitle } from '../../components/ui';
import {
  deleteFood,
  getFoodsForDate,
  MEAL_LABELS,
  type FoodEntry,
  type MealType,
} from '../../db/database';
import { deleteFoodRecord } from '../../health/healthConnect';
import { todayKey } from '../../lib/date';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function NutritionScreen() {
  const [date, setDate] = useState(todayKey());
  const [foods, setFoods] = useState<FoodEntry[]>([]);

  const load = useCallback(async () => {
    setFoods(await getFoodsForDate(date));
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmDelete = (food: FoodEntry) => {
    Alert.alert('Eintrag löschen?', food.name, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteFood(food.id);
          await deleteFoodRecord(food.id);
          load();
        },
      },
    ]);
  };

  const sum = (key: 'kcal' | 'protein' | 'carbs' | 'fat') =>
    Math.round(foods.reduce((s, f) => s + f[key], 0));

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <DateSwitcher date={date} onChange={setDate} />

      <Card style={styles.summary}>
        <Summary label="kcal" value={sum('kcal')} color={colors.kcal} />
        <Summary label="Protein" value={sum('protein')} color={colors.protein} unit="g" />
        <Summary label="Kohlenh." value={sum('carbs')} color={colors.carbs} unit="g" />
        <Summary label="Fett" value={sum('fat')} color={colors.fat} unit="g" />
      </Card>

      {MEALS.map((meal) => {
        const items = foods.filter((f) => f.meal === meal);
        const kcal = Math.round(items.reduce((s, f) => s + f.kcal, 0));
        return (
          <Card key={meal}>
            <SectionTitle
              right={
                <Pressable
                  hitSlop={10}
                  onPress={() => router.push({ pathname: '/food/new', params: { meal, date } })}
                >
                  <Ionicons name="add-circle" size={28} color={colors.primary} />
                </Pressable>
              }
            >
              {MEAL_LABELS[meal]} {kcal > 0 ? <Text style={styles.mealKcal}>· {kcal} kcal</Text> : null}
            </SectionTitle>
            {items.length === 0 ? (
              <Text style={styles.empty}>Noch nichts eingetragen</Text>
            ) : (
              items.map((f) => (
                <Pressable key={f.id} onLongPress={() => confirmDelete(f)} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{f.name}</Text>
                    <Text style={styles.itemMacros}>
                      P {Math.round(f.protein)} g · K {Math.round(f.carbs)} g · F {Math.round(f.fat)} g
                    </Text>
                  </View>
                  <Text style={styles.itemKcal}>{Math.round(f.kcal)} kcal</Text>
                </Pressable>
              ))
            )}
          </Card>
        );
      })}
      <Text style={styles.tip}>Tipp: Lange auf einen Eintrag drücken, um ihn zu löschen.</Text>
    </ScrollView>
  );
}

function Summary({
  label,
  value,
  color,
  unit = '',
}: {
  label: string;
  value: number;
  color: string;
  unit?: string;
}) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color }}>
        {value}
        {unit}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row' },
  mealKcal: { fontSize: 14, fontWeight: '400', color: colors.muted },
  empty: { color: colors.muted, fontStyle: 'italic' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemName: { fontSize: 16, color: colors.text },
  itemMacros: { fontSize: 12, color: colors.muted, marginTop: 2 },
  itemKcal: { fontWeight: '600', color: colors.text },
  tip: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: spacing.sm },
});
