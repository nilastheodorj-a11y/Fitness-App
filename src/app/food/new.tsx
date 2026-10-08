import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColors, useStyles } from '../../components/ThemeContext';
import { radius, spacing, type Colors } from '../../components/theme';
import { Button, Card, Chip, Field, formatNumber, parseNumber, SectionTitle } from '../../components/ui';
import {
  addFood,
  getRecentFoods,
  MEAL_LABELS,
  saveProduct,
  type FoodEntry,
  type MealType,
} from '../../db/database';
import { syncFood } from '../../health';
import { todayKey } from '../../lib/date';
import { takeScanResult } from '../../lib/scanStore';

const MEALS = Object.keys(MEAL_LABELS) as MealType[];

function defaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

const str = (n: number) => (n ? String(n) : '');

export default function NewFoodScreen() {
  const styles = useStyles(createStyles);
  const colors = useColors();
  const params = useLocalSearchParams<{ meal?: MealType; date?: string; scan?: string }>();
  const date = params.date ?? todayKey();

  const [meal, setMeal] = useState<MealType>(params.meal ?? defaultMeal());
  const [name, setName] = useState('');
  const [per100, setPer100] = useState(false);
  const [amount, setAmount] = useState('100');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [barcode, setBarcode] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [recent, setRecent] = useState<FoodEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRecentFoods().then(setRecent);
  }, []);

  // Direkt den Scanner öffnen, wenn über das Barcode-Symbol gestartet
  const openScannerOnStart = params.scan === '1';
  useEffect(() => {
    if (openScannerOnStart) router.push('/food/scan');
  }, [openScannerOnStart]);

  // Ergebnis vom Barcode-Scanner übernehmen, sobald der Bildschirm wieder sichtbar ist
  useFocusEffect(
    useCallback(() => {
      const scan = takeScanResult();
      if (!scan) return;
      setBarcode(scan.barcode);
      setPer100(true);
      if (scan.product) {
        const p = scan.product;
        setName(p.name);
        setKcal(str(p.kcal));
        setProtein(str(p.protein));
        setCarbs(str(p.carbs));
        setFat(str(p.fat));
        setAmount(String(p.serving_g ?? 100));
        setScanInfo(p.serving_g ? `Produkt gefunden – Menge auf 1 Portion (${p.serving_g} g) gesetzt.` : 'Produkt gefunden.');
      } else {
        setName('');
        setKcal('');
        setProtein('');
        setCarbs('');
        setFat('');
        setAmount('100');
        setScanInfo(
          `Produkt ${scan.barcode} ist unbekannt. Trag die Werte pro 100 g von der Verpackung ein – beim nächsten Scan sind sie gespeichert.`
        );
      }
    }, [])
  );

  const factor = per100 ? parseNumber(amount) / 100 : 1;
  const p = parseNumber(protein) * factor;
  const c = parseNumber(carbs) * factor;
  const f = parseNumber(fat) * factor;
  // Wenn keine Kalorien angegeben sind, aus den Makros berechnen (4/4/9 kcal pro g)
  const k = kcal.trim() ? parseNumber(kcal) * factor : p * 4 + c * 4 + f * 9;

  const fillFrom = (food: FoodEntry) => {
    setName(food.name);
    setPer100(false);
    setBarcode(null);
    setScanInfo(null);
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
      if (barcode && per100) {
        const per100Kcal = kcal.trim()
          ? parseNumber(kcal)
          : parseNumber(protein) * 4 + parseNumber(carbs) * 4 + parseNumber(fat) * 9;
        await saveProduct({
          barcode,
          name: name.trim(),
          kcal: Math.round(per100Kcal),
          protein: parseNumber(protein),
          carbs: parseNumber(carbs),
          fat: parseNumber(fat),
          serving_g: null,
        });
      }
      const food = await addFood({
        date,
        meal,
        name: per100 ? `${name.trim()} (${formatNumber(parseNumber(amount), 0)} g)` : name.trim(),
        kcal: Math.round(k),
        protein: Math.round(p * 10) / 10,
        carbs: Math.round(c * 10) / 10,
        fat: Math.round(f * 10) / 10,
      });
      await syncFood(food);
      router.back();
    } catch (e) {
      Alert.alert('Fehler beim Speichern', String(e));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.scanButton} onPress={() => router.push('/food/scan')}>
          <Ionicons name="barcode-outline" size={28} color={colors.primary} />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={styles.scanTitle}>Barcode scannen</Text>
            <Text style={styles.scanSub}>Nährwerte automatisch übernehmen</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        {scanInfo && (
          <View style={styles.info}>
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text style={styles.infoText}>{scanInfo}</Text>
          </View>
        )}

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
        {per100 && <Field label="Menge (g)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />}

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

const createStyles = (c: Colors) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
    row: { flexDirection: 'row' },
    total: { alignItems: 'center' },
    totalText: { fontWeight: '600', color: c.text },
    scanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.primarySoft,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    scanTitle: { color: c.text, fontWeight: '700', fontSize: 16 },
    scanSub: { color: c.muted, fontSize: 12 },
    info: {
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: radius.sm,
      padding: spacing.sm,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    infoText: { color: c.text, marginLeft: spacing.sm, flex: 1, fontSize: 13 },
  });
