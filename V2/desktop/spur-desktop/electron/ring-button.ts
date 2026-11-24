type RingSource = 'ring' | 'ring-recording';
type Subscription = { source?: RingSource; generation: number };

interface ButtonState {
  link?: string;
  source?: RingSource;
  paused: boolean;
  canConfigure: boolean;
}

/** Subscribe to physical gestures independently of a dictation session. */
export class RingButton {
  private link?: string;
  private generation = 0;
  private applied?: RingSource;
  private pending?: Subscription;
  private failure?: { source?: RingSource; message: string };

  constructor(private ports: {
    current(): ButtonState;
    configure(source?: RingSource): Promise<unknown>;
    status(value?: 'ready' | 'paused' | 'preparing' | 'error', message?: string): void;
  }) {}

  get acceptsPress(): boolean {
    const { link, source, paused } = this.ports.current();
    if (!link || link !== this.link || !source || paused) return false;
    // A physical event can precede the reply to the native arm request.
    return this.pending ? this.pending.source === source && this.pending.generation === this.generation : this.applied === source;
  }

  nativeDisarmed(): void {
    this.applied = undefined;
    // A cancelled native arm can still reply successfully after the disarm event.
    if (this.pending?.source) this.generation++;
  }
  retry(): void { this.failure = undefined; this.refresh(); }

  refresh(): void {
    const { link, source, paused, canConfigure } = this.ports.current();
    if (link !== this.link) {
      this.link = link; this.generation++; this.applied = undefined; this.failure = undefined;
    }
    const desired = paused ? undefined : source;
    if (this.failure && this.failure.source !== desired) this.failure = undefined;
    if (!link) { this.ports.status(); return; }
    if (this.failure) this.ports.status('error', this.failure.message);
    else if (!source) this.ports.status();
    else if (paused) this.ports.status('paused');
    else this.ports.status(!this.pending && this.applied === desired ? 'ready' : 'preparing');
    if (!canConfigure || this.pending || this.failure || this.applied === desired) return;

    const request = this.pending = { source: desired, generation: this.generation };
    void this.ports.configure(desired).then(() => {
      if (request.generation === this.generation) this.applied = desired;
    }, error => {
      if (request.generation === this.generation) {
        this.failure = { source: desired, message: error instanceof Error ? error.message : 'Could not configure the ring button.' };
      }
    }).finally(() => {
      this.pending = undefined;
      this.refresh();
    });
  }
}
