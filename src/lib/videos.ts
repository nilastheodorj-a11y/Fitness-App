import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/**
 * Erklärvideos werden in den App-eigenen Speicher kopiert, damit sie verfügbar bleiben,
 * auch wenn das Original in der Galerie gelöscht wird.
 */
function videoDir(): Directory {
  const dir = new Directory(Paths.document, 'videos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export type VideoSource = 'library' | 'camera';

/** Öffnet Galerie oder Kamera und gibt die URI der gespeicherten Kopie zurück (oder null bei Abbruch). */
export async function pickAndStoreVideo(source: VideoSource): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['videos'],
    allowsEditing: false,
    quality: 1,
    videoMaxDuration: 600,
  };

  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Kamerazugriff wurde nicht erlaubt.');
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const ext = asset.fileName?.split('.').pop() ?? asset.uri.split('.').pop() ?? 'mp4';
  const target = new File(videoDir(), `exercise-${Date.now()}.${ext.toLowerCase()}`);
  await new File(asset.uri).copy(target);
  return target.uri;
}

export function deleteStoredVideo(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (e) {
    console.warn('Video konnte nicht gelöscht werden', e);
  }
}
