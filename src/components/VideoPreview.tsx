import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet } from 'react-native';

import { radius } from './theme';

/** Spielt ein lokal gespeichertes Erklärvideo ab (mit Vollbild & Steuerung). */
export function VideoPreview({ uri, loop = false }: { uri: string; loop?: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
  });

  return (
    <VideoView
      style={styles.video}
      player={player}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
