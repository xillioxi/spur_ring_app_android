import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LoaderCircle, Sparkles } from 'lucide-react-native';

import { processAudioWithAi } from '@/services/audioAgentApi';
import type { NativeFile } from '@/native/YanqiangVoiceNative';
import { colors } from '@/theme/colors';
import { t } from '@/locales';

type State =
  | { phase: 'idle' }
  | { phase: 'processing' }
  | { phase: 'completed'; transcript: string; output: string }
  | { phase: 'failed'; error: string };

export function AudioAiPanel({ file, onLog }: { file: NativeFile; onLog: (message: string) => void }) {
  const [state, setState] = useState<State>({ phase: 'idle' });

  async function processFile() {
    if (state.phase === 'processing') return;
    setState({ phase: 'processing' });
    onLog(`ai: uploading ${file.name}`);
    try {
      const result = await processAudioWithAi({ uri: file.uri, name: file.name });
      setState({ phase: 'completed', transcript: result.transcript, output: result.agent.output });
      onLog(`ai: completed ${file.name} task=${result.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ phase: 'failed', error: message });
      onLog(`ai: FAILED ${file.name} ${message}`);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.button, state.phase === 'processing' && styles.disabled]}
        disabled={state.phase === 'processing'}
        onPress={() => void processFile()}
      >
        {state.phase === 'processing' ? <LoaderCircle color="#fff" size={16} /> : <Sparkles color="#fff" size={16} />}
        <Text style={styles.buttonText}>
          {state.phase === 'processing' ? t.sync.ai.processing : t.sync.ai.process}
        </Text>
      </Pressable>
      {state.phase === 'failed' && <Text style={styles.error}>{state.error}</Text>}
      {state.phase === 'completed' && (
        <View style={styles.result}>
          <Text style={styles.label}>{t.sync.ai.transcript}</Text>
          <Text style={styles.content}>{state.transcript}</Text>
          <Text style={styles.label}>{t.sync.ai.result}</Text>
          <Text style={styles.content}>{state.output}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginTop: 10, gap: 9 },
  button: { minHeight: 40, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  result: { backgroundColor: colors.background, borderRadius: 12, padding: 12, gap: 6 },
  label: { color: colors.primary, fontSize: 11, fontWeight: '800', marginTop: 2 },
  content: { color: colors.text, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 16 }
});
