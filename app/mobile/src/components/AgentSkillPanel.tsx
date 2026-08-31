import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Check, Mic, X } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

import { captureVoiceIntent, rewriteCardResult } from '@/services/assistantSkillApi';
import { getLocalAgentCard, updateAgentCardResult, type LocalAgentCard } from '@/services/localAgentCards';
import { inferOfficeKind, startOfficeJob } from '@/services/officeJob';
import { colors } from '@/theme/colors';
import { t } from '@/locales';

const FAB = 56;
const PAD = 16;
const PREVIEW_W = 260;
const PREVIEW_ESTIMATE = 160;
const WAVE_W = 78;
const SKY = '#4FC3F7';
const SKY_DEEP = '#29B6F6';

type Phase = 'idle' | 'listening' | 'recognizing' | 'ready' | 'rewriting';

type Props = {
  card: LocalAgentCard;
  onApplied: (card: LocalAgentCard) => void;
};

export function AgentSkillPanel({ card, onApplied }: Props) {
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('idle');
  const [intentText, setIntentText] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startedAt = useRef(0);
  const cardRef = useRef(card);
  cardRef.current = card;

  const x = useSharedValue(width - FAB - PAD);
  const y = useSharedValue(Math.max(PAD + 80, height - FAB - 140));
  const dragOriginX = useSharedValue(0);
  const dragOriginY = useSharedValue(0);
  const waveOpen = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    return () => {
      void stopRecordingOnly();
    };
  }, []);

  useEffect(() => {
    setPhase('idle');
    setIntentText('');
    void stopRecordingOnly();
  }, [card.id]);

  useEffect(() => {
    const open = phase === 'listening';
    waveOpen.value = withTiming(open ? 1 : 0, {
      duration: 280,
      easing: Easing.out(Easing.cubic)
    });
    if (open) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(0, { duration: 180 });
    }
  }, [phase, pulse, waveOpen]);

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      dragOriginX.value = x.value;
      dragOriginY.value = y.value;
    })
    .onUpdate((e) => {
      const maxX = width - FAB - PAD;
      const maxY = height - FAB - PAD;
      const nextX = dragOriginX.value + e.translationX;
      const nextY = dragOriginY.value + e.translationY;
      x.value = Math.min(Math.max(nextX, PAD), maxX);
      y.value = Math.min(Math.max(nextY, PAD + 48), maxY);
    });

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }]
  }));

  const waveStyle = useAnimatedStyle(() => ({
    opacity: waveOpen.value,
    transform: [
      { translateX: interpolate(waveOpen.value, [0, 1], [28, 0]) },
      { scaleX: interpolate(waveOpen.value, [0, 1], [0.35, 1]) }
    ]
  }));

  const previewStyle = useAnimatedStyle(() => {
    const left = Math.min(
      Math.max(PAD, x.value + FAB / 2 - PREVIEW_W / 2),
      width - PREVIEW_W - PAD
    );
    const preferAbove = y.value > height / 2;
    const top = preferAbove
      ? Math.max(PAD + 48, y.value - PREVIEW_ESTIMATE - 10)
      : Math.min(y.value + FAB + 10, height - PREVIEW_ESTIMATE - PAD);
    return { left, top };
  });

  async function beginListening() {
    if (phase !== 'idle' && phase !== 'ready') return;
    if (phase === 'ready') {
      setIntentText('');
    }
    if (card.office?.status === 'generating') return;
    startedAt.current = Date.now();
    try {
      await stopRecordingOnly();
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t.agentFeed.skill.title, t.agentFeed.skill.micDenied);
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setPhase('listening');
    } catch (error) {
      recordingRef.current = null;
      Alert.alert(t.agentFeed.skill.title, error instanceof Error ? error.message : String(error));
      setPhase('idle');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true
      }).catch(() => undefined);
    }
  }

  async function finishListening() {
    if (phase !== 'listening') return;
    if (Date.now() - startedAt.current < 350) {
      await stopRecordingOnly();
      setPhase('idle');
      return;
    }
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) {
      setPhase('idle');
      return;
    }
    try {
      setPhase('recognizing');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error('No recording URI');
      const name = `dictation-${Date.now()}.m4a`;
      const dest = `${FileSystem.cacheDirectory}${name}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      const result = await captureVoiceIntent({ uri: dest, name });
      setIntentText(result.intent.trim() || result.transcript.trim());
      setPhase('ready');
    } catch (error) {
      Alert.alert(t.agentFeed.skill.title, error instanceof Error ? error.message : String(error));
      setPhase('idle');
    } finally {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(
        () => undefined
      );
    }
  }

  async function stopRecordingOnly() {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (recording) await recording.stopAndUnloadAsync().catch(() => undefined);
  }

  async function confirmApply() {
    const instruction = intentText.trim();
    if (!instruction) {
      Alert.alert(t.agentFeed.skill.title, t.agentFeed.skill.needInstruction);
      return;
    }
    const current = cardRef.current;
    const officeKind = inferOfficeKind(instruction);
    if (current.office?.status === 'generating') {
      Alert.alert(t.agentFeed.skill.title, t.agentFeed.doc.wait);
      return;
    }
    const hasImage = Boolean(current.imageUrl);
    if (
      !officeKind &&
      !hasImage &&
      !(current.output || '').trim() &&
      !(current.transcript || '').trim()
    ) {
      Alert.alert(t.agentFeed.skill.title, t.agentFeed.skill.needContent);
      return;
    }
    try {
      if (officeKind) {
        setPhase('rewriting');
        const prompt = [instruction, current.output, current.transcript].filter(Boolean).join('\n\n');
        await startOfficeJob(current, officeKind, prompt);
        const latest = await getLocalAgentCard(current.id);
        if (latest) onApplied(latest);
        setIntentText('');
        setPhase('idle');
        return;
      }
      setPhase('rewriting');
      const result = await rewriteCardResult({
        instruction,
        transcript: current.transcript,
        previousOutput: current.output,
        title: current.title,
        rewriteImage: hasImage
      });
      const updated = await updateAgentCardResult(current, {
        output: result.output,
        imageUrl: hasImage ? result.imageUrl : undefined
      });
      onApplied(updated);
      setIntentText('');
      setPhase('idle');
    } catch (error) {
      Alert.alert(t.agentFeed.skill.title, error instanceof Error ? error.message : String(error));
      setPhase('ready');
    }
  }

  function discardPreview() {
    setIntentText('');
    setPhase('idle');
  }

  function onOrbPress() {
    if (card.office?.status === 'generating') return;
    if (phase === 'idle' || phase === 'ready') void beginListening();
    else if (phase === 'listening') void finishListening();
  }

  const busy =
    phase === 'recognizing'
      ? t.agentFeed.skill.recognizing
      : phase === 'rewriting'
        ? t.agentFeed.skill.rewriting
        : phase === 'listening'
          ? t.agentFeed.skill.tapToStop
          : null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {phase === 'ready' ? (
        <Animated.View pointerEvents="box-none" style={[styles.preview, previewStyle]}>
          <Text style={styles.previewLabel}>{t.agentFeed.skill.preview}</Text>
          <Text style={styles.previewText}>{intentText}</Text>
          <View style={styles.previewActions}>
            <Pressable style={styles.discardBtn} onPress={discardPreview} hitSlop={8}>
              <X color={colors.text} size={16} />
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={() => void confirmApply()}>
              <Check color="#fff" size={16} />
              <Text style={styles.confirmText}>{t.agentFeed.skill.apply}</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.orbWrap, floatStyle]}>
          <Animated.View style={[styles.waveRail, waveStyle]} pointerEvents="none">
            <VoiceBars active={phase === 'listening'} pulse={pulse} />
          </Animated.View>
          <Pressable
            style={[styles.orb, phase === 'listening' && styles.orbListening]}
            onPress={onOrbPress}
            disabled={phase === 'recognizing' || phase === 'rewriting' || card.office?.status === 'generating'}
          >
            {phase === 'recognizing' || phase === 'rewriting' ? (
              <ActivityIndicator color="#fff" />
            ) : phase === 'listening' ? (
              <Check color="#fff" size={24} />
            ) : (
              <Mic color="#fff" size={22} />
            )}
          </Pressable>
          {busy ? <Text style={styles.hint}>{busy}</Text> : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function VoiceBars({
  active,
  pulse
}: {
  active: boolean;
  pulse: SharedValue<number>;
}) {
  const heights = [10, 18, 28, 16, 24, 12, 20];
  return (
    <View style={styles.waveRow}>
      {heights.map((base, index) => (
        <WaveBar key={index} base={base} index={index} active={active} pulse={pulse} />
      ))}
    </View>
  );
}

function WaveBar({
  base,
  index,
  active,
  pulse
}: {
  base: number;
  index: number;
  active: boolean;
  pulse: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    if (!active) return { height: 8, opacity: 0.35 };
    const phaseShift = ((index % 5) + 1) * 0.12;
    const t = (pulse.value + phaseShift) % 1;
    const amp = 0.55 + 0.45 * Math.sin(t * Math.PI * 2);
    return {
      height: Math.max(8, base * amp),
      opacity: 0.55 + 0.45 * amp
    };
  });
  return <Animated.View style={[styles.waveBar, style]} />;
}

const styles = StyleSheet.create({
  orbWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FAB,
    alignItems: 'center'
  },
  waveRail: {
    position: 'absolute',
    right: FAB + 6,
    top: (FAB - 36) / 2,
    width: WAVE_W,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(79,195,247,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32
  },
  waveBar: {
    width: 3.5,
    borderRadius: 2,
    backgroundColor: SKY_DEEP
  },
  orb: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    backgroundColor: SKY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SKY_DEEP,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6
  },
  orbListening: {
    backgroundColor: SKY_DEEP
  },
  hint: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: 100
  },
  preview: {
    position: 'absolute',
    width: PREVIEW_W,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  previewLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  previewText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600'
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12
  },
  discardBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5'
  },
  confirmBtn: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: SKY_DEEP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  confirmText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800'
  }
});
