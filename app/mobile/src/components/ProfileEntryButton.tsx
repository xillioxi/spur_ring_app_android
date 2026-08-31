import { Pressable, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { colors } from '@/theme/colors';

export function ProfileEntryButton() {
  const navigation = useNavigation<any>();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      hitSlop={8}
      style={styles.button}
      onPress={() => navigation.navigate('Me')}
    >
      <User color={colors.text} size={20} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  }
});
