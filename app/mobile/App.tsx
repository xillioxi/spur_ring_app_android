import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import {
  YanqiangVoiceEventNames,
  YanqiangVoiceEvents,
  YanqiangVoiceNative,
  type RingDictationAudio
} from './src/native/YanqiangVoiceNative';
import { captureVoiceIntent } from './src/services/assistantSkillApi';
import { startAutoSyncWatch } from './src/services/autoSyncRecordings';
import { ensureDemoContent } from './src/services/demoContent';
import { preparePlayback } from './src/services/localAudioLibrary';
import { colors } from './src/theme/colors';

export default function App() {
  useEffect(() => {
    void preparePlayback().catch(() => undefined);
    void ensureDemoContent().catch(() => undefined);
    if (YanqiangVoiceNative.isAvailable) {
      void YanqiangVoiceNative.getElevenLabsApiKey(
        process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY?.trim() || ''
      ).catch((error) => {
        console.warn('[dictation] unable to initialize local credential', error);
      });
      void YanqiangVoiceNative.resumeBackgroundSync().catch((error) => {
        console.warn('[backgroundSync] unable to resume', error);
      });
    }
    startAutoSyncWatch();
  }, []);

  useEffect(() => {
    // Compatibility fallback for older native builds that still emit completed M4A files.
    const subscription = YanqiangVoiceEvents?.addListener(
      YanqiangVoiceEventNames.dictationAudio,
      (audio: RingDictationAudio) => {
        void captureVoiceIntent({ uri: audio.uri, name: audio.name })
          .then((result) => YanqiangVoiceNative.completeRingDictation(result.transcript))
          .catch((error) =>
            YanqiangVoiceNative.failRingDictation(
              error instanceof Error ? error.message : 'Spur transcription failed'
            )
          );
      }
    );
    return () => subscription?.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" backgroundColor={colors.background} />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
