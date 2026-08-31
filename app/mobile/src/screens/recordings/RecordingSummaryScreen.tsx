import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen } from '@/components/AppScreen';
import { AudioPlayer } from '@/components/AudioPlayer';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { RecordingMetaRow } from '@/components/RecordingMetaRow';
import { recordingApi } from '@/services/api/recordingService';
import { colors } from '@/theme/colors';
import { t } from '@/locales';
import type { RecordingDetail } from '@/types';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'RecordingSummary'>;

export function RecordingSummaryScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [record, setRecord] = useState<RecordingDetail | null>(null);

  useEffect(() => {
    recordingApi.getRecording(id).then(setRecord);
  }, [id]);

  return (
    <View style={styles.root}>
      <AppScreen bottomInset={120}>
        <PageHeader
          right={
            <Pressable style={styles.transcriptButton} onPress={() => navigation.navigate('Transcript', { id })}>
              <FileText color={colors.primary} size={16} />
              <Text style={styles.transcriptButtonText}>{t.recordings.transcript}</Text>
            </Pressable>
          }
        />
        {!record ? (
          <LoadingState />
        ) : (
          <>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{record.title}</Text>
              <RecordingMetaRow record={record} />
              <View style={styles.tagRow}>
                {record.tags.map((tag) => (
                  <Text key={tag} style={styles.tag}>
                    {tag}
                  </Text>
                ))}
              </View>
            </View>
            <View style={styles.hairline} />
            <View style={styles.attendeeSection}>
              <Text style={styles.sectionEyebrow}>{t.recordings.attendees}</Text>
              <View style={styles.speakerWrap}>
                {record.speakers.map((speaker) => (
                  <Text key={speaker.id} style={[styles.speaker, { color: speaker.color }]}>
                    {speaker.name} {speaker.role}
                  </Text>
                ))}
              </View>
            </View>
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>{t.recordings.overview}</Text>
              {record.summarySections.map((section) => (
                <View key={section.title} style={styles.summaryBlock}>
                  {section.bullets.map((bullet) => (
                    <View style={styles.summaryBullet} key={bullet}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.summaryText}>
                        <Text style={styles.summaryLead}>{section.title}：</Text>
                        {bullet}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </>
        )}
      </AppScreen>
      <AudioPlayer duration={record?.duration} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  transcriptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  transcriptButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700'
  },
  titleBlock: {
    paddingTop: 18,
    paddingBottom: 16
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800'
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14
  },
  tag: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border
  },
  attendeeSection: {
    paddingVertical: 18
  },
  sectionEyebrow: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 8
  },
  speakerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  speaker: {
    fontSize: 14,
    fontWeight: '700'
  },
  summarySection: {
    paddingBottom: 18
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 14
  },
  summaryBlock: {
    marginBottom: 10
  },
  summaryBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 7
  },
  summaryText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 23
  },
  summaryLead: {
    fontWeight: '800'
  }
});
