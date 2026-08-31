import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { startAutoSyncWatch } from './src/services/autoSyncRecordings';
import { ensureDemoContent } from './src/services/demoContent';
import { preparePlayback } from './src/services/localAudioLibrary';
import { colors } from './src/theme/colors';

export default function App() {
  useEffect(() => {
    void preparePlayback().catch(() => undefined);
    void ensureDemoContent().catch(() => undefined);
    startAutoSyncWatch();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
