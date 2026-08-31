import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pause, Play, RotateCcw } from 'lucide-react-native';

import { colors } from '@/theme/colors';

interface AudioPlayerProps {
  duration?: string;
  playing?: boolean;
  onToggle?: () => void;
}

export function AudioPlayer({ duration = '00:00', playing = false, onToggle }: AudioPlayerProps) {
  return (
    <View style={styles.root}>
      <Pressable style={styles.iconButton} onPress={onToggle}>
        {playing ? <Pause color={colors.text} size={20} /> : <Play color={colors.text} size={20} fill={colors.text} />}
      </Pressable>
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={styles.progressValue} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>00:00</Text>
          <Text style={styles.time}>{duration}</Text>
        </View>
      </View>
      <Pressable style={styles.iconButton}>
        <RotateCcw color={colors.textSecondary} size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    minHeight: 72,
    borderRadius: 24,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft
  },
  progressWrap: {
    flex: 1,
    marginHorizontal: 12
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden'
  },
  progressValue: {
    width: '18%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  timeRow: {
    marginTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  time: {
    fontSize: 11,
    color: colors.textTertiary
  }
});
