/**
 * Frozen navigation shell from the pre-homepage application.
 *
 * The underlying screens remain the production implementations used by the new
 * shell, so recording, transcription, assistant, hardware, and document features
 * are not forked. This file preserves the old two-tab composition for reference.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Bot, Mic2 } from 'lucide-react-native';

import { AgentFlowScreen } from '@/screens/assistant/AgentFlowScreen';
import { RecordingListScreen } from '@/screens/recordings/RecordingListScreen';
import { colors } from '@/theme/colors';

const LegacyTabs = createBottomTabNavigator();

export function LegacyAppNavigator() {
  return (
    <LegacyTabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.text }}>
      <LegacyTabs.Screen
        name="LegacyRecordings"
        component={RecordingListScreen}
        options={{ title: 'Recordings', tabBarIcon: ({ color, size }) => <Mic2 color={color} size={size} /> }}
      />
      <LegacyTabs.Screen
        name="LegacyAssistant"
        component={AgentFlowScreen}
        options={{ title: 'AI Assistant', tabBarIcon: ({ color, size }) => <Bot color={color} size={size} /> }}
      />
    </LegacyTabs.Navigator>
  );
}
