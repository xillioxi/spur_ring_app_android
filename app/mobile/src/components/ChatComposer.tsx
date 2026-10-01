import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SendHorizontal } from 'lucide-react-native';

import { colors } from '@/theme/colors';
import { t } from '@/locales';

interface ChatComposerProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatComposer({ onSubmit, placeholder, disabled }: ChatComposerProps) {
  const [value, setValue] = useState('');

  function submit() {
    if (disabled) return;
    const query = value.trim();
    if (!query) return;
    setValue('');
    onSubmit(query);
  }

  return (
    <View style={[styles.root, disabled && styles.disabled]}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder ?? t.assistant.placeholder}
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        returnKeyType="send"
        editable={!disabled}
        onSubmitEditing={submit}
      />
      <Pressable style={[styles.sendButton, disabled && styles.sendDisabled]} onPress={submit} disabled={disabled}>
        <SendHorizontal color="#fff" size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 0
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  disabled: {
    opacity: 0.7
  },
  sendDisabled: {
    opacity: 0.55
  }
});
