import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Bluetooth, ChevronLeft, Laptop, RefreshCw } from 'lucide-react-native';

import { AppScreen } from '@/components/AppScreen';
import { getRingUiSession } from '@/services/ringConnectionSession';
import { colors } from '@/theme/colors';

export function SyncHubScreen() {
  const navigation = useNavigation<any>();
  const connected = getRingUiSession().connectionState === 'connected';

  return (
    <AppScreen tone="plain" bottomInset={32}>
      <View style={styles.topBar}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft color={colors.text} size={23} />
        </Pressable>
        <Text style={styles.title}>Sync</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIcon}><RefreshCw color="#ffffff" size={25} /></View>
        <Text style={styles.heroTitle}>{connected ? 'Your ring is connected' : 'Bring your captures together'}</Text>
        <Text style={styles.heroText}>Ring recordings sync automatically when connected. Open ring controls for pairing, transfer status, and hardware tools.</Text>
      </View>

      <Text style={styles.eyebrow}>CONNECTIONS</Text>
      <Pressable style={styles.row} onPress={() => navigation.navigate('Device')}>
        <View style={[styles.rowIcon, styles.ringIcon]}><Bluetooth color="#3f6df6" size={20} /></View>
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>Spur Ring</Text>
          <Text style={styles.rowText}>{connected ? 'Connected · automatic sync active' : 'Pair, sync, and manage recording controls'}</Text>
        </View>
        <ArrowRight color={colors.textTertiary} size={18} />
      </Pressable>
      <Pressable style={styles.row} onPress={() => navigation.navigate('ConnectLaptop')}>
        <View style={[styles.rowIcon, styles.laptopIcon]}><Laptop color="#7b52ed" size={20} /></View>
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>Spur Buddy</Text>
          <Text style={styles.rowText}>Connect a laptop for desktop tasks and files</Text>
        </View>
        <ArrowRight color={colors.textTertiary} size={18} />
      </Pressable>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Automatic sync</Text>
        <Text style={styles.noteText}>Keep your ring near your phone with Bluetooth enabled. New captures appear in Notes and Processes after transfer.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 18 },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  hero: { borderRadius: 26, padding: 21, backgroundColor: '#0b1422', marginBottom: 28 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3f6df6', marginBottom: 24 },
  heroTitle: { color: '#ffffff', fontSize: 23, fontWeight: '900' },
  heroText: { color: '#a8b4c7', fontSize: 13, lineHeight: 20, marginTop: 8 },
  eyebrow: { color: colors.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 9, marginLeft: 3 },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 20, padding: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 11 },
  rowIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  ringIcon: { backgroundColor: '#203248' },
  laptopIcon: { backgroundColor: '#302544' },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  rowText: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  note: { padding: 16, borderRadius: 18, backgroundColor: colors.card, marginTop: 12 },
  noteTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  noteText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 5 }
});
