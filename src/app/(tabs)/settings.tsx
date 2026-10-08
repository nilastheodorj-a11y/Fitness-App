import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme, useStyles, type ThemePreference } from '../../components/ThemeContext';
import { spacing, type Colors } from '../../components/theme';
import { Button, Card, Field, parseNumber, SectionTitle, Segmented } from '../../components/ui';
import { getBodyWeight, getGoals, saveGoals, setSetting } from '../../db/database';
import {
  canOpenSettings,
  connect,
  disconnect,
  getStatus,
  healthName,
  healthUnavailableReason,
  isEnabled,
  openSettings,
  permissionSummary,
  type HealthStatus,
} from '../../health';

const HEALTH_CONNECT_PLAY_STORE =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

export default function SettingsScreen() {
  const styles = useStyles(createStyles);
  const { preference, setPreference } = useAppTheme();

  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [weight, setWeight] = useState('');

  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const loadHealth = useCallback(async () => {
    const s = await getStatus();
    setStatus(s);
    const on = await isEnabled();
    setEnabled(on);
    setSummary(on ? await permissionSummary() : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      getGoals().then((g) => {
        setKcal(String(g.kcal));
        setProtein(String(g.protein));
        setCarbs(String(g.carbs));
        setFat(String(g.fat));
      });
      getBodyWeight().then((w) => setWeight(String(w).replace('.', ',')));
      loadHealth();
    }, [loadHealth])
  );

  const saveAll = async () => {
    await saveGoals({
      kcal: Math.round(parseNumber(kcal)),
      protein: Math.round(parseNumber(protein)),
      carbs: Math.round(parseNumber(carbs)),
      fat: Math.round(parseNumber(fat)),
    });
    await setSetting('weightKg', String(parseNumber(weight) || 75));
    Alert.alert('Gespeichert', 'Deine Ziele wurden aktualisiert.');
  };

  /** Kalorienziel aus den Makros berechnen (4/4/9 kcal pro g). */
  const kcalFromMacros = () => {
    const total = parseNumber(protein) * 4 + parseNumber(carbs) * 4 + parseNumber(fat) * 9;
    setKcal(String(Math.round(total)));
  };

  const onConnect = async () => {
    setConnecting(true);
    try {
      const ok = await connect();
      if (!ok) {
        Alert.alert(
          'Keine Berechtigungen',
          `Du hast ${healthName()} keinen Zugriff erlaubt. Du kannst das jederzeit nachholen.`
        );
      }
    } catch (e) {
      Alert.alert('Verbindung fehlgeschlagen', String(e));
    } finally {
      setConnecting(false);
      loadHealth();
    }
  };

  const onDisconnect = async () => {
    await disconnect();
    loadHealth();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <SectionTitle>{healthName()}</SectionTitle>
        <HealthStatusRow status={status} enabled={enabled} summary={summary} />

        {status === 'available' && !enabled && (
          <Button title={`Mit ${healthName()} verbinden`} icon="heart" onPress={onConnect} loading={connecting} />
        )}
        {status === 'available' && enabled && (
          <>
            <Button title="Berechtigungen erneut anfragen" variant="secondary" icon="key" onPress={onConnect} loading={connecting} />
            {canOpenSettings() && (
              <Button title={`${healthName()} öffnen`} variant="secondary" icon="open" onPress={openSettings} />
            )}
            <Button title="Synchronisierung beenden" variant="secondary" icon="close-circle" onPress={onDisconnect} />
          </>
        )}
        {(status === 'not_installed' || status === 'update_required') && (
          <Button
            title={status === 'not_installed' ? 'Health Connect installieren' : 'Health Connect aktualisieren'}
            icon="download"
            onPress={() => Linking.openURL(HEALTH_CONNECT_PLAY_STORE)}
          />
        )}
        <Text style={styles.hint}>
          Gelesen werden Schritte, verbrannte Kalorien und Trainings anderer Apps
          {Platform.OS === 'ios' ? ' (z. B. Apple Watch).' : ' (z. B. Smartwatch, Google Fit, Samsung Health).'} Deine
          Mahlzeiten und Trainings aus FitTrack werden dort gespeichert.
          {Platform.OS === 'ios'
            ? ' Berechtigungen änderst du unter Einstellungen › Gesundheit › Datenzugriff & Geräte › FitTrack.'
            : ''}
        </Text>
      </Card>

      <Card>
        <SectionTitle>Darstellung</SectionTitle>
        <Segmented<ThemePreference>
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Hell' },
            { value: 'dark', label: 'Dunkel' },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Tagesziele</SectionTitle>
        <Field label="Kalorien (kcal)" value={kcal} onChangeText={setKcal} keyboardType="number-pad" />
        <View style={{ flexDirection: 'row' }}>
          <Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="number-pad" />
          <View style={{ width: spacing.sm }} />
          <Field label="Kohlenh. (g)" value={carbs} onChangeText={setCarbs} keyboardType="number-pad" />
          <View style={{ width: spacing.sm }} />
          <Field label="Fett (g)" value={fat} onChangeText={setFat} keyboardType="number-pad" />
        </View>
        <Button title="Kalorien aus Makros berechnen" variant="secondary" icon="calculator" onPress={kcalFromMacros} />
      </Card>

      <Card>
        <SectionTitle>Körper</SectionTitle>
        <Field label="Körpergewicht (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <Text style={styles.hint}>Wird zur Schätzung der verbrannten Kalorien bei Aktivitäten verwendet.</Text>
      </Card>

      <Button title="Speichern" icon="checkmark" onPress={saveAll} />
    </ScrollView>
  );
}

function HealthStatusRow({
  status,
  enabled,
  summary,
}: {
  status: HealthStatus | null;
  enabled: boolean;
  summary: string | null;
}) {
  const styles = useStyles(createStyles);
  const { colors } = useAppTheme();
  let icon: 'checkmark-circle' | 'alert-circle' | 'close-circle' = 'alert-circle';
  let color = colors.muted;
  let text = 'Wird geprüft …';

  if (status === 'unsupported') {
    icon = 'close-circle';
    text = healthUnavailableReason();
  } else if (status === 'not_installed') {
    text = 'Health Connect ist auf diesem Gerät nicht installiert.';
  } else if (status === 'update_required') {
    text = 'Health Connect muss aktualisiert werden.';
  } else if (status === 'available' && enabled) {
    icon = 'checkmark-circle';
    color = colors.success;
    text = summary ? `Verbunden · ${summary}` : 'Verbunden';
  } else if (status === 'available') {
    text = 'Verfügbar, aber nicht verbunden.';
  }

  return (
    <View style={styles.status}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statusText, { color }]}>{text}</Text>
    </View>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    hint: { color: c.muted, fontSize: 12, marginTop: spacing.xs },
    status: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    statusText: { marginLeft: spacing.sm, flex: 1 },
  });
