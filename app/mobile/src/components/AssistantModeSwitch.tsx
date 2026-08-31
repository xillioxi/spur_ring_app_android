import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { t } from '@/locales';

interface AssistantModeSwitchProps {
  value: 'model' | 'agent';
  onChange: (value: 'model' | 'agent') => void;
}

export function AssistantModeSwitch({ value, onChange }: AssistantModeSwitchProps) {
  return (
    <View style={styles.root}>
      <SwitchItem active={value === 'model'} label={t.assistant.model} onPress={() => onChange('model')} />
      <SwitchItem active={value === 'agent'} label="AI Agent" onPress={() => onChange('agent')} />
    </View>
  );
}

function SwitchItem({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.item, active && styles.itemActive]} onPress={onPress}>
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    backgroundColor: '#ebe5dc',
    marginBottom: 16
  },
  item: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999
  },
  itemActive: {
    backgroundColor: colors.card
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  },
  textActive: {
    color: colors.text
  }
});
