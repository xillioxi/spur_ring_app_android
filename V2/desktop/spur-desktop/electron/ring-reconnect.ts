export type ReconnectPhase = 'waiting' | 'connecting' | undefined;
export type ReconnectResult = 'connected' | 'retry' | 'stop';

interface ReconnectOptions {
  canAttempt(): boolean;
  connect(address: string, signal: AbortSignal): Promise<ReconnectResult>;
  onPhase?(phase: ReconnectPhase): void;
}

const bluetoothMac = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i;
const coreBluetoothUUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function isRingIdentifier(value: unknown, platform?: 'windows' | 'macos'): value is string {
  if (typeof value !== 'string') return false;
  return (platform !== 'macos' && bluetoothMac.test(value)) || (platform !== 'windows' && coreBluetoothUUID.test(value));
}

const retryDelays = [5000, 15000, 30000, 60000];

/** Runs one connection attempt to the remembered ring at a time. */
export class RingReconnect {
  private target: string | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private active?: AbortController;
  private retryIndex = -1;
  private stopped = false;
  private phase: ReconnectPhase;

  constructor(private readonly options: ReconnectOptions) {}

  setTarget(address: string | null): void {
    const target = isRingIdentifier(address) ? address.toUpperCase() : null;
    if (target !== this.target || this.stopped) {
      this.clearTimer();
      this.target = target;
      this.stopped = false;
      this.retryIndex = -1;
      this.active?.abort();
    }
    this.refresh();
  }

  /** Reconcile whenever service availability, user work or link state changes. */
  refresh(): void {
    if (this.active) {
      this.setPhase(this.active.signal.aborted ? undefined : 'connecting');
      return;
    }
    if (!this.target || this.stopped || !this.options.canAttempt()) {
      this.clearTimer();
      this.setPhase(undefined);
      return;
    }
    if (this.timer === undefined) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.attempt();
      }, retryDelays[this.retryIndex] ?? 0);
    }
    this.setPhase('waiting');
  }

  private async attempt(): Promise<void> {
    const target = this.target;
    if (!target || !this.options.canAttempt()) {
      this.refresh();
      return;
    }
    const active = new AbortController();
    this.active = active;
    this.setPhase('connecting');
    let result: ReconnectResult = 'retry';
    try {
      if (!active.signal.aborted) result = await this.options.connect(target, active.signal);
    } catch {
      // A transient service or Bluetooth error follows the same retry schedule.
    } finally {
      if (!active.signal.aborted) {
        if (result === 'stop') this.stopped = true;
        else if (result === 'connected') this.retryIndex = 0;
        else this.retryIndex = Math.min(this.retryIndex + 1, retryDelays.length - 1);
      }
      this.active = undefined;
      this.refresh();
    }
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private setPhase(phase: ReconnectPhase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    this.options.onPhase?.(phase);
  }
}
