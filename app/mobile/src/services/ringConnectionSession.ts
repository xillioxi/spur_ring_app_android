type ScanDevice = {
  name: string
  macAddress: string
  address?: string
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

type RingUiSession = {
  initialized: boolean
  connectionState: ConnectionState
  connectedMac: string | null
  devices: Record<string, ScanDevice>
}

const session: RingUiSession = {
  initialized: false,
  connectionState: 'disconnected',
  connectedMac: null,
  devices: {},
}

/** In-memory UI cache only — does not call native connect/disconnect. */
export function getRingUiSession(): RingUiSession {
  return {
    ...session,
    devices: { ...session.devices },
  }
}

export function setRingUiInitialized(value: boolean) {
  session.initialized = value
}

export function setRingUiConnection(state: ConnectionState, mac: string | null = session.connectedMac) {
  session.connectionState = state
  session.connectedMac = state === 'disconnected' ? null : mac
}

export function setRingUiDevices(devices: Record<string, ScanDevice>) {
  session.devices = { ...devices }
}

export function upsertRingUiDevice(device: ScanDevice) {
  session.devices = { ...session.devices, [device.macAddress]: device }
}

export type { ScanDevice, ConnectionState }
