import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen } from '@/components/AppScreen';
import { AudioPlayer } from '@/components/AudioPlayer';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { recordingApi } from '@/services/api/recordingService';
import { colors } from '@/theme/colors';
import { t } from '@/locales';
import type { RecordingDetail, TranscriptSegment } from '@/types';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Transcript'>;

export function TranscriptScreen({ route }: Props) {
  const { id } = route.params;
  const [record, setRecord] = useState<RecordingDetail | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  useEffect(() => {
    Promise.all([recordingApi.getRecording(id), recordingApi.getTranscript(id)]).then(([nextRecord, nextSegments]) => {
      setRecord(nextRecord);
      setSegments(nextSegments);
    });
  }, [id]);

  const speakerMap = useMemo(() => new Map(record?.speakers.map((speaker) => [speaker.id, speaker]) ?? []), [record]);

  return (
    <View style={styles.root}>
      <AppScreen bottomInset={120}>
        <PageHeader title={t.recordings.transcript} />
        {!record ? (
          <LoadingState />
        ) : (
          <View style={styles.list}>
            <View style={styles.rail} />
            {segments.map((segment) => {
              const speaker = speakerMap.get(segment.speakerId);
              return (
                <View style={styles.segment} key={segment.id}>
                  <View style={styles.speakerLine}>
                    <Text style={[styles.speaker, { color: speaker?.color ?? colors.text }]}>
                      {speaker?.name} {speaker?.role}
                    </Text>
                    <Text style={styles.time}>{segment.time}</Text>
                  </View>
                  <Text style={styles.segmentText}>{renderText(segment)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </AppScreen>
      <AudioPlayer duration={record?.duration} />
    </View>
  );
}

function renderText(segment: TranscriptSegment) {
  if (!segment.highlight) return segment.text;
  return `${segment.text}${segment.edited ? ' ✎' : ''}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  list: {
    marginTop: 18,
    paddingLeft: 22
  },
  rail: {
    position: 'absolute',
    top: 2,
    bottom: 4,
    left: 5,
    width: 2,
    borderRadius: 999,
    backgroundColor: colors.border
  },
  segment: {
    paddingBottom: 24
  },
  speakerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  speaker: {
    fontSize: 15,
    fontWeight: '800'
  },
  time: {
    color: colors.textTertiary,
    fontSize: 12
  },
  segmentText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24
  }
});
