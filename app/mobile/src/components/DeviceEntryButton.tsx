import { Pressable, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { colors } from '@/theme/colors';

export function DeviceEntryButton() {
  const navigation = useNavigation<any>();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add or manage device"
      hitSlop={8}
      style={styles.button}
      onPress={() => navigation.navigate('Device')}
    >
      <Plus color={colors.text} size={22} strokeWidth={2.4} />
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
