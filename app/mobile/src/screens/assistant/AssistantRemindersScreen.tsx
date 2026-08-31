import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowUpRight,
  FileText,
  Lightbulb,
  ListChecks,
  Mic2,
  Sparkles,
  WandSparkles
} from 'lucide-react-native';

import { AppScreen } from '@/components/AppScreen';
import { AssistantModeSwitch } from '@/components/AssistantModeSwitch';
import { LoadingState } from '@/components/LoadingState';
import { t } from '@/locales';
import { recordingApi } from '@/services/api/recordingService';
import { colors } from '@/theme/colors';
import type { ReminderCard } from '@/types';

type CardTone = 'orange' | 'blue' | 'green' | 'violet';

const CARD_TONES: CardTone[] = ['orange', 'blue', 'green', 'violet'];

export function AssistantRemindersScreen() {
  const navigation = useNavigation<any>();
  const [reminders, setReminders] = useState<ReminderCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    recordingApi
      .listReminders()
      .then(setReminders)
      .finally(() => setLoading(false));
  }, []);

  const columns = useMemo(
    () => ({
      left: reminders.filter((_, index) => index % 2 === 0),
      right: reminders.filter((_, index) => index % 2 === 1)
    }),
    [reminders]
  );

  return (
    <AppScreen tone="soft" bottomInset={96}>
      <AssistantModeSwitch
        value="agent"
        onChange={(value) => {
          if (value === 'model') navigation.navigate('AssistantModel');
        }}
      />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <WandSparkles color="#fff" size={21} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{t.agentFeed.eyebrow}</Text>
          <Text style={styles.title}>{t.agentFeed.title}</Text>
          <Text style={styles.subtitle}>{t.agentFeed.subtitle}</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <View style={[styles.filterChip, styles.filterChipActive]}>
          <Sparkles color={colors.primary} size={13} />
          <Text style={styles.filterTextActive}>{t.agentFeed.all}</Text>
        </View>
        <View style={styles.filterChip}>
          <Text style={styles.filterText}>{t.agentFeed.ideas}</Text>
        </View>
        <View style={styles.filterChip}>
          <Text style={styles.filterText}>{t.agentFeed.reports}</Text>
        </View>
      </View>

      {loading ? (
        <LoadingState />
      ) : (
        <View style={styles.waterfall}>
          <View style={styles.column}>
            {columns.left.map((reminder, index) => (
              <AgentCard key={reminder.id} reminder={reminder} index={index * 2} />
            ))}
          </View>
          <View style={[styles.column, styles.rightColumn]}>
            {columns.right.map((reminder, index) => (
              <AgentCard key={reminder.id} reminder={reminder} index={index * 2 + 1} />
            ))}
          </View>
        </View>
      )}
    </AppScreen>
  );
}

function AgentCard({ reminder, index }: { reminder: ReminderCard; index: number }) {
  const tone = CARD_TONES[index % CARD_TONES.length];
  const Icon = [Lightbulb, FileText, ListChecks, Mic2][index % 4];
  const featured = index % 3 === 0;

  return (
    <Pressable style={({ pressed }) => [styles.card, featured && styles.featuredCard, pressed && styles.cardPressed]}>
      <View style={[styles.iconBox, toneStyles[tone].icon]}>
        <Icon color={toneStyles[tone].color} size={18} />
      </View>
      <Text style={[styles.category, { color: toneStyles[tone].color }]}>
        {categoryLabel(index)}
      </Text>
      <Text style={styles.cardTitle}>{reminder.title}</Text>
      <View style={styles.bulletList}>
        {reminder.bullets.slice(0, featured ? 2 : 1).map((bullet, bulletIndex) => (
          <Text key={`${reminder.id}-${bulletIndex}`} style={styles.bullet}>
            {bullet}
          </Text>
        ))}
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.sourcePill}>
          <Mic2 color={colors.textTertiary} size={11} />
          <Text style={styles.sourceText}>{reminder.duration}</Text>
        </View>
        <ArrowUpRight color={colors.textTertiary} size={16} />
      </View>
      <Text style={styles.cardDate}>{reminder.date}</Text>
    </Pressable>
  );
}

function categoryLabel(index: number) {
  return [
    t.agentFeed.category.idea,
    t.agentFeed.category.report,
    t.agentFeed.category.action,
    t.agentFeed.category.summary
  ][index % 4];
}

const toneStyles = {
  orange: { color: '#E45D2A', icon: { backgroundColor: '#FFF0E8' } },
  blue: { color: '#2873D3', icon: { backgroundColor: '#EAF3FF' } },
  green: { color: '#168765', icon: { backgroundColor: '#E8F7F1' } },
  violet: { color: '#7957C8', icon: { backgroundColor: '#F1ECFF' } }
} as const;

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 18,
    marginBottom: 18
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4
  },
  heroCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 27, lineHeight: 32, fontWeight: '900', marginTop: 3 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  filterChipActive: { flexDirection: 'row', gap: 5, backgroundColor: colors.primarySoft },
  filterText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  waterfall: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  column: { flex: 1, gap: 10 },
  rightColumn: { paddingTop: 22 },
  card: {
    borderRadius: 20,
    padding: 13,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEE9E2',
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  featuredCard: { paddingBottom: 17 },
  cardPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  iconBox: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  category: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6 },
  cardTitle: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  bulletList: { marginTop: 9, gap: 7 },
  bullet: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 },
  sourcePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.background, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 10 },
  sourceText: { color: colors.textTertiary, fontSize: 9, fontWeight: '700' },
  cardDate: { color: colors.textTertiary, fontSize: 9, marginTop: 8 }
});
