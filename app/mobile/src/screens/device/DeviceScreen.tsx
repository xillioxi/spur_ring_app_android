import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bluetooth, FileAudio, Mic, Radio, Square } from 'lucide-react-native';

import { AppScreen } from '@/components/AppScreen';
import { LoadingState } from '@/components/LoadingState';
import { SMART_RING_AUDIO_FORMAT, SmartRingBleSdk, type SmartRingConnection, type SmartRingDevice } from '@/sdk/smartRing';
import { colors } from '@/theme/colors';
import { t } from '@/locales';

export function DeviceScreen() {
  const sdk = useMemo(() => new SmartRingBleSdk(), []);
  const [devices, setDevices] = useState<SmartRingDevice[]>([]);
  const [connection, setConnection] = useState<SmartRingConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [packetCount, setPacketCount] = useState(0);
  const [adpcmBytes, setAdpcmBytes] = useState(0);
  const [pcmSamples, setPcmSamples] = useState(0);
  const [lostPackets, setLostPackets] = useState(0);
  const [wavPath, setWavPath] = useState<string | null>(null);
  const [status, setStatus] = useState(t.legacyDevice.waiting);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const offAudioNotify = sdk.onAudioNotify((packet) => {
      if (packet.type === 'record_begin') {
        setRecording(true);
        setPacketCount(0);
        setAdpcmBytes(0);
        setPcmSamples(0);
        setLostPackets(0);
        setWavPath(null);
      }

      if (packet.type === 'adpcm_data') {
        const stats = sdk.getRecordingStats();
        setPacketCount(stats.packetCount);
        setAdpcmBytes(stats.adpcmBytes ?? 0);
        setPcmSamples(stats.pcmSamples ?? 0);
        setLostPackets(stats.lostPackets ?? 0);
      }

      if (packet.type === 'record_end') {
        setRecording(false);
        setTimeout(() => {
          const stats = sdk.getRecordingStats();
          setPacketCount(stats.packetCount);
          setAdpcmBytes(stats.adpcmBytes ?? 0);
          setPcmSamples(stats.pcmSamples ?? 0);
          setLostPackets(stats.lostPackets ?? 0);
          setWavPath(stats.wavPath ?? null);
        }, 300);
      }
    });

    const offLog = sdk.onLog((message) => {
      setStatus(message);
      setLogs((value) => [`${new Date().toLocaleTimeString()} ${message}`, ...value].slice(0, 8));
    });

    return () => {
      offAudioNotify();
      offLog();
      sdk.destroy();
    };
  }, [sdk]);

  async function scan() {
    setLoading(true);
    setStatus(t.legacyDevice.scanning);

    try {
      const nextDevices = await sdk.scan({
        timeoutMs: 10000,
        onDeviceFound: (device) => {
          setDevices((value) => {
            const exists = value.some((item) => item.id === device.id);
            return exists ? value.map((item) => (item.id === device.id ? device : item)) : [...value, device];
          });
        }
      });
      setDevices(nextDevices);
      setStatus(nextDevices.length ? t.legacyDevice.scanComplete(nextDevices.length) : t.legacyDevice.noneFound);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.legacyDevice.scanFailed);
    } finally {
      setLoading(false);
    }
  }

  async function connect(deviceId: string) {
    setLoading(true);

    try {
      const nextConnection = await sdk.connect(deviceId);
      setConnection(nextConnection);
      setStatus(t.legacyDevice.connected(nextConnection.device.name));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.legacyDevice.connectFailed);
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    try {
      setPacketCount(0);
      setAdpcmBytes(0);
      setPcmSamples(0);
      setLostPackets(0);
      setWavPath(null);
      await sdk.startRecording();
      setRecording(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.legacyDevice.startFailed);
    }
  }

  async function stopRecording() {
    try {
      const stats = await sdk.stopRecording();
      setPacketCount(stats.packetCount);
      setAdpcmBytes(stats.adpcmBytes ?? 0);
      setPcmSamples(stats.pcmSamples ?? 0);
      setLostPackets(stats.lostPackets ?? 0);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.legacyDevice.stopFailed);
    }
  }

  async function disconnect() {
    try {
      await sdk.disconnect();
      setConnection(null);
      setRecording(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.legacyDevice.disconnectFailed);
    }
  }

  async function openWav() {
    if (!wavPath) return;

    try {
      await Linking.openURL(wavPath);
    } catch (error) {
      setStatus(error instanceof Error ? `${t.legacyDevice.openFailed}: ${error.message}` : t.legacyDevice.openFailed);
    }
  }

  return (
    <AppScreen tone="soft" bottomInset={96}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t.legacyDevice.title}</Text>
        <Text style={styles.subtitle}>{t.legacyDevice.subtitle}</Text>

        <View style={styles.protocolCard}>
          <Text style={styles.protocolTitle}>{t.legacyDevice.protocol}</Text>
          <Text style={styles.protocolText}>
            {SMART_RING_AUDIO_FORMAT.encoding} {SMART_RING_AUDIO_FORMAT.sampleRateHz}Hz / {t.legacyDevice.monoDecoded} {SMART_RING_AUDIO_FORMAT.bitsPerSample}bit PCM
          </Text>
          <Text style={styles.protocolText}>Start: 00 09 71 00 01 · Stop: 00 09 71 00 00</Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Radio color={colors.primary} size={20} />
          </View>
          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>{t.legacyDevice.currentStatus}</Text>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.primaryButton, loading && styles.disabledButton]} onPress={scan} disabled={loading}>
            <Bluetooth color="#fff" size={18} />
            <Text style={styles.primaryButtonText}>{loading ? t.legacyDevice.processing : t.device.scanDevices}</Text>
          </Pressable>

          {connection && (
            <Pressable style={styles.secondaryButton} onPress={disconnect}>
              <Text style={styles.secondaryButtonText}>{t.device.disconnect}</Text>
            </Pressable>
          )}
        </View>

        {loading && <LoadingState label={t.legacyDevice.bleWorking} />}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.legacyDevice.nearby}</Text>
          {devices.length === 0 ? (
            <Text style={styles.emptyText}>{t.legacyDevice.empty}</Text>
          ) : (
            devices.map((device) => (
              <Pressable key={device.id} style={styles.deviceCard} onPress={() => connect(device.id)}>
                <View style={styles.deviceIcon}>
                  <Bluetooth color={colors.primary} size={22} />
                </View>
                <View style={styles.deviceContent}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceMeta}>RSSI {device.rssi ?? '--'} · {device.id}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {connection && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.legacyDevice.loopTest}</Text>
            <View style={styles.connectedCard}>
              <Text style={styles.deviceName}>{connection.device.name}</Text>
              <Text style={styles.deviceMeta}>Service {connection.serviceUuid}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{packetCount}</Text>
                  <Text style={styles.statLabel}>{t.legacyDevice.packets}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{adpcmBytes}</Text>
                  <Text style={styles.statLabel}>ADPCM bytes</Text>
                </View>
              </View>
              <View style={styles.statsRowCompact}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{pcmSamples}</Text>
                  <Text style={styles.statLabel}>PCM samples</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, lostPackets > 0 && styles.dangerText]}>{lostPackets}</Text>
                  <Text style={styles.statLabel}>{t.legacyDevice.lost}</Text>
                </View>
              </View>

              <Pressable style={[styles.recordButton, recording && styles.stopButton]} onPress={recording ? stopRecording : startRecording}>
                {recording ? <Square color="#fff" size={18} /> : <Mic color="#fff" size={18} />}
                <Text style={styles.recordButtonText}>{recording ? t.legacyDevice.stop : t.legacyDevice.start}</Text>
              </Pressable>

              {wavPath && (
                <View style={styles.wavCard}>
                  <Text style={styles.wavTitle}>{t.legacyDevice.wavSaved}</Text>
                  <Text style={styles.wavPath}>{wavPath}</Text>
                  <Pressable style={styles.openButton} onPress={openWav}>
                    <FileAudio color={colors.primary} size={17} />
                    <Text style={styles.openButtonText}>{t.legacyDevice.openWav}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.device.debugLogs}</Text>
          <View style={styles.logCard}>
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>{t.common.noLogs}</Text>
            ) : (
              logs.map((log) => (
                <Text key={log} style={styles.logText}>
                  {log}
                </Text>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 18
  },
  protocolCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.cardSoft,
    marginBottom: 14,
    gap: 6
  },
  protocolTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800'
  },
  protocolText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 15,
    gap: 12,
    marginBottom: 14
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusContent: {
    flex: 1
  },
  statusTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800'
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  disabledButton: {
    opacity: 0.65
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  secondaryButton: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  section: {
    marginBottom: 22
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 13,
    lineHeight: 20
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 15,
    gap: 12,
    marginBottom: 10
  },
  deviceIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  deviceContent: {
    flex: 1
  },
  deviceName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  deviceMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 5
  },
  connectedCard: {
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 16
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 14
  },
  statsRowCompact: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  statBox: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.cardSoft,
    padding: 14
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900'
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 4
  },
  dangerText: {
    color: colors.danger
  },
  recordButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  stopButton: {
    backgroundColor: colors.danger
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900'
  },
  wavCard: {
    borderRadius: 18,
    backgroundColor: colors.cardSoft,
    padding: 14,
    marginTop: 12
  },
  wavTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900'
  },
  wavPath: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6
  },
  openButton: {
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12
  },
  openButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800'
  },
  logCard: {
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 14,
    gap: 8
  },
  logText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18
  }
});
