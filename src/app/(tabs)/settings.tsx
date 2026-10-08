import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../components/theme';
import { Button, Card, Field, parseNumber, SectionTitle } from '../../components/ui';
import { getGoals, getSetting, saveGoals, setSetting } from '../../db/database';
import {
  connect,
  disconnect,
  getGrantedCount,
  getStatus,
  isEnabled,
  openSettings,
  PERMISSIONS,
  type HealthConnectStatus,
} from '../../health/healthConnect';

const HEALTH_CONNECT_PLAY_STORE =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

export default function SettingsScreen() {
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [weight, setWeight] = useState('');

  const [status, setStatus] = useState<HealthConnectStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [granted, setGranted] = useState(0);
  const [connecting, setConnecting] = useState(false);

  const loadHealth = useCallback(async () => {
    setStatus(await getStatus());
    setEnabled(await isEnabled());
    setGranted(await getGrantedCount());
  }, []);

  useFocusEffect(
    useCallback(() => {
      getGoals().then((g) => {
        setKcal(String(g.kcal));
        setProtein(String(g.protein));
        setCarbs(String(g.carbs));
        setFat(String(g.fat));
      });
      getSetting('weightKg').then((w) => setWeight(w ?? '75'));
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
      const count = await connect();
      if (count === 0) {
        Alert.alert(
          'Keine Berechtigungen',
          'Du hast keine Berechtigungen erteilt. Du kannst sie jederzeit in Health Connect ändern.'
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
        <SectionTitle>Google Health Connect</SectionTitle>
        <HealthStatus status={status} enabled={enabled} granted={granted} />

        {status === 'available' && !enabled && (
          <Button title="Mit Health Connect verbinden" icon="heart" onPress={onConnect} loading={connecting} />
        )}
        {status === 'available' && enabled && (
          <>
            {granted < PERMISSIONS.length && (
              <Button title="Berechtigungen erneut anfragen" icon="key" onPress={onConnect} loading={connecting} />
            )}
            <Button title="Health Connect öffnen" variant="secondary" icon="open" onPress={openSettings} />
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
          Gelesen werden Schritte, verbrannte Kalorien und Trainings anderer Apps (z. B. Smartwatch, Google
          Fit, Samsung Health). Deine Mahlzeiten und Aktivitäten aus FitTrack werden nach Health Connect
          geschrieben.
        </Text>
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

function HealthStatus({
  status,
  enabled,
  granted,
}: {
  status: HealthConnectStatus | null;
  enabled: boolean;
  granted: number;
}) {
  let icon: 'checkmark-circle' | 'alert-circle' | 'close-circle' = 'alert-circle';
  let color = colors.muted;
  let text = 'Wird geprüft …';

  if (status === 'unsupported') {
    icon = 'close-circle';
    text = 'Health Connect ist nur auf Android in einem eigenen App-Build (nicht Expo Go) verfügbar.';
  } else if (status === 'not_installed') {
    text = 'Health Connect ist auf diesem Gerät nicht installiert.';
  } else if (status === 'update_required') {
    text = 'Health Connect muss aktualisiert werden.';
  } else if (status === 'available' && enabled) {
    icon = 'checkmark-circle';
    color = colors.success;
    text = `Verbunden · ${granted} von ${PERMISSIONS.length} Berechtigungen erteilt`;
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

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  status: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  statusText: { marginLeft: spacing.sm, flex: 1 },
});
