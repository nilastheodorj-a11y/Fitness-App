import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../components/theme';
import { Button, Chip, Field, parseNumber } from '../../components/ui';
import { VideoPreview } from '../../components/VideoPreview';
import { addExercise, getExercise, updateExercise } from '../../db/database';
import { MUSCLE_GROUPS } from '../../lib/muscleGroups';
import { deleteStoredVideo, pickAndStoreVideo, type VideoSource } from '../../lib/videos';

/** Neue Übung anlegen oder (mit ?id=) eine bestehende bearbeiten. */
export default function ExerciseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;

  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [description, setDescription] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const originalVideo = useRef<string | null>(null);
  const saved = useRef(false);
  const latestVideo = useRef<string | null>(null);
  latestVideo.current = videoUri;

  useEffect(() => {
    if (editId == null) return;
    getExercise(editId).then((e) => {
      if (!e) return;
      setName(e.name);
      setGroup(e.muscle_group);
      setDescription(e.description);
      setSets(e.sets ? String(e.sets) : '');
      setReps(e.reps);
      setVideoUri(e.video_uri);
      originalVideo.current = e.video_uri;
    });
  }, [editId]);

  // Beim Verlassen ohne Speichern ein neu hochgeladenes Video wieder entfernen
  useEffect(
    () => () => {
      if (!saved.current && latestVideo.current && latestVideo.current !== originalVideo.current) {
        deleteStoredVideo(latestVideo.current);
      }
    },
    []
  );

  const pick = async (source: VideoSource) => {
    setBusy(true);
    try {
      const uri = await pickAndStoreVideo(source);
      if (uri) {
        if (videoUri && videoUri !== originalVideo.current) deleteStoredVideo(videoUri);
        setVideoUri(uri);
      }
    } catch (e) {
      Alert.alert('Video konnte nicht geladen werden', String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeVideo = () => {
    if (videoUri && videoUri !== originalVideo.current) deleteStoredVideo(videoUri);
    setVideoUri(null);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Bitte gib einen Namen für die Übung ein.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        muscle_group: group,
        description: description.trim(),
        sets: sets.trim() ? Math.round(parseNumber(sets)) : null,
        reps: reps.trim(),
        video_uri: videoUri,
      };
      if (editId != null) {
        await updateExercise({ ...data, id: editId });
      } else {
        await addExercise(data);
      }
      // Altes Video aufräumen, falls es ersetzt oder entfernt wurde
      if (originalVideo.current && originalVideo.current !== videoUri) {
        deleteStoredVideo(originalVideo.current);
      }
      saved.current = true;
      router.back();
    } catch (e) {
      Alert.alert('Fehler beim Speichern', String(e));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editId != null ? 'Übung bearbeiten' : 'Übung erstellen' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Erklärvideo</Text>
        {videoUri ? (
          <View style={{ marginBottom: spacing.md }}>
            <VideoPreview key={videoUri} uri={videoUri} />
            <View style={{ height: spacing.sm }} />
            <Button title="Video entfernen" variant="secondary" icon="trash" onPress={removeVideo} />
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button
              title={videoUri ? 'Andere wählen' : 'Aus Galerie'}
              variant="secondary"
              icon="images"
              onPress={() => pick('library')}
              loading={busy}
            />
          </View>
          <View style={{ width: spacing.sm }} />
          <View style={{ flex: 1 }}>
            <Button title="Aufnehmen" variant="secondary" icon="videocam" onPress={() => pick('camera')} disabled={busy} />
          </View>
        </View>

        <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Bankdrücken" />

        <Text style={styles.label}>Muskelgruppe</Text>
        <View style={styles.chips}>
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g} label={g} selected={group === g} onPress={() => setGroup(group === g ? '' : g)} />
          ))}
        </View>

        <View style={styles.row}>
          <Field label="Sätze" value={sets} onChangeText={setSets} keyboardType="number-pad" placeholder="3" />
          <View style={{ width: spacing.sm }} />
          <Field label="Wiederholungen" value={reps} onChangeText={setReps} placeholder="8–12" />
        </View>

        <Field
          label="Anleitung / Hinweise"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Ausführung, worauf achten, typische Fehler …"
        />

        <Button title="Speichern" icon="checkmark" onPress={save} loading={saving} disabled={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, marginBottom: 6, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  row: { flexDirection: 'row' },
});
