import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { useStyles } from '../../components/ThemeContext';
import { radius, spacing, type Colors } from '../../components/theme';
import { Button, Field } from '../../components/ui';
import { lookupBarcode } from '../../lib/openFoodFacts';
import { setScanResult } from '../../lib/scanStore';

export default function ScanScreen() {
  const styles = useStyles(createStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const locked = useRef(false);

  const handleBarcode = async (barcode: string) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const result = await lookupBarcode(barcode);
    if (result.status === 'error') {
      setBusy(false);
      Alert.alert(
        'Keine Verbindung',
        `Das Produkt konnte nicht abgefragt werden (${result.message}). Du kannst die Werte selbst eingeben.`,
        [
          { text: 'Nochmal scannen', onPress: () => (locked.current = false) },
          {
            text: 'Selbst eingeben',
            onPress: () => {
              setScanResult({ barcode, product: null });
              router.back();
            },
          },
        ]
      );
      return;
    }
    setScanResult({ barcode, product: result.status === 'found' ? result.product : null });
    router.back();
  };

  const onScanned = (e: BarcodeScanningResult) => handleBarcode(e.data);

  if (!permission) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={48} color={styles.muted.color} />
        <Text style={styles.text}>FitTrack braucht die Kamera, um Barcodes zu scannen.</Text>
        <Button title="Kamera erlauben" icon="camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={busy ? undefined : onScanned}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.overlayText}>
          {busy ? 'Produkt wird gesucht …' : 'Barcode in den Rahmen halten'}
        </Text>
        {busy && <ActivityIndicator color="#fff" style={{ marginTop: spacing.md }} />}
      </View>
      <View style={styles.manual}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Field
            label="Oder Barcode eintippen"
            value={manual}
            onChangeText={setManual}
            keyboardType="number-pad"
            placeholder="z. B. 4000417025005"
          />
          <View style={{ width: spacing.sm }} />
          <View style={{ marginBottom: spacing.md }}>
            <Button
              title="Suchen"
              onPress={() => manual.trim().length >= 6 && handleBarcode(manual.trim())}
              disabled={busy || manual.trim().length < 6}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: c.background },
    text: { color: c.text, textAlign: 'center', marginVertical: spacing.lg, fontSize: 16 },
    muted: { color: c.muted },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    frame: {
      width: '75%',
      aspectRatio: 1.8,
      borderWidth: 3,
      borderColor: '#fff',
      borderRadius: radius.lg,
    },
    overlayText: {
      color: '#fff',
      marginTop: spacing.lg,
      fontSize: 16,
      fontWeight: '600',
      textShadowColor: '#000',
      textShadowRadius: 4,
    },
    manual: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: c.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
    },
  });
