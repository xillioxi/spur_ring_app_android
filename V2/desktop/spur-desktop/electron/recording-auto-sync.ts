type Reason = 'finished' | 'reconnected';
interface Pending {
  address: string;
  finished: boolean;
  backlog: boolean;
  due: number;
  retry: boolean;
}

/** A ready notification is a hint to drain this ring's queue, not a file or a dictation command. */
export class RecordingAutoSync {
  private pending?: Pending;
  private timer?: NodeJS.Timeout;
  private running = false;
  private generation = 0;

  constructor(private ports: {
    canSync(address: string): boolean;
    download(address: string, checkInventory: boolean): Promise<number | undefined>;
    failed(message: string): void;
  }) {}

  request(address: string, reason: Reason): void {
    const item = this.pending?.address === address ? this.pending : undefined;
    this.pending = {
      address, finished: reason === 'finished' || !!item?.finished,
      backlog: reason === 'reconnected' || !!item?.backlog,
      // Allow the firmware to close the file before issuing the download command.
      due: reason === 'finished' ? Date.now() + 650 : item?.due ?? Date.now() + 650,
      retry: reason === 'finished' || !!item?.retry,
    };
    this.refresh();
  }

  covered(address: string, liveFile = false): void {
    if (this.pending?.address !== address) return;
    if (liveFile && this.pending.backlog) {
      this.pending.finished = this.pending.retry = false;
    } else this.pending = undefined;
    this.refresh();
  }

  reset(): void {
    this.generation++;
    this.pending = undefined;
    this.clearTimer();
  }

  refresh(): void {
    if (!this.pending || this.running || !this.ports.canSync(this.pending.address)) {
      this.clearTimer();
    } else if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.drain();
      }, Math.max(0, this.pending.due - Date.now()));
    }
  }

  private clearTimer(): void { clearTimeout(this.timer); this.timer = undefined; }

  private async drain(): Promise<void> {
    const item = this.pending;
    if (!item || this.running || !this.ports.canSync(item.address)) return;
    if (item.due > Date.now()) { this.refresh(); return; }
    this.pending = undefined;
    this.running = true;
    const generation = this.generation;
    let empty = false;
    try {
      empty = await this.ports.download(item.address, !item.finished) === 0;
    } catch (error) {
      if (generation === this.generation) this.ports.failed(error instanceof Error ? error.message : 'The recording download failed.');
      empty = true;
    } finally {
      this.running = false;
      if (generation === this.generation && empty && item.retry && !this.pending) {
        this.pending = { ...item, retry: false, due: Date.now() + 2000 };
      }
      this.refresh();
    }
  }
}
