import { StyleSheet, Text, View } from 'react-native';
import { Clock3, MapPin } from 'lucide-react-native';

import { colors } from '@/theme/colors';
import { t } from '@/locales';
import type { RecordingMeta } from '@/types';

interface RecordingMetaRowProps {
  record: Pick<RecordingMeta, 'duration' | 'date' | 'source' | 'location' | 'syncState'>;
  compact?: boolean;
}

export function RecordingMetaRow({ record, compact = false }: RecordingMetaRowProps) {
  return (
    <View style={[styles.root, compact && styles.compact]}>
      <View style={styles.item}>
        <Clock3 size={13} color={colors.textTertiary} />
        <Text style={styles.text}>{record.duration}</Text>
      </View>
      <Text style={styles.text}>{record.date}</Text>
      {!!record.source && <Text style={styles.text}>{record.source}</Text>}
      {!!record.location && (
        <View style={styles.item}>
          <MapPin size={13} color={colors.textTertiary} />
          <Text style={styles.text}>{record.location}</Text>
        </View>
      )}
      {!!record.syncState && <Text style={[styles.sync, syncColor(record.syncState)]}>{syncLabel(record.syncState)}</Text>}
    </View>
  );
}

function syncLabel(state: RecordingMeta['syncState']) {
  if (state === 'synced') return t.recordingState.synced;
  if (state === 'syncing') return t.recordingState.syncing;
  if (state === 'failed') return t.recordingState.failed;
  return t.recordingState.local;
}

function syncColor(state: RecordingMeta['syncState']) {
  if (state === 'synced') return { color: colors.success };
  if (state === 'failed') return { color: colors.danger };
  return { color: colors.textTertiary };
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  compact: {
    marginTop: 6
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  text: {
    color: colors.textTertiary,
    fontSize: 12
  },
  sync: {
    fontSize: 12,
    fontWeight: '700'
  }
});
