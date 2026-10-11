/** One timer and one task at a time. Explicit wake-ups supersede idle waits. */
export class BackgroundTaskLoop {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private wakePending = false;
  private stopped = false;

  constructor(
    private readonly task: () => Promise<number>,
    private readonly failureDelayMs: number,
    private readonly onError: (error: unknown) => void
  ) {}

  wake(): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.running) this.wakePending = true;
    else this.schedule(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.running;
  }

  private schedule(delayMs: number): void {
    this.timer = setTimeout(
      () => {
        this.timer = null;
        this.running = this.turn();
      },
      Math.max(0, delayMs)
    );
    this.timer.unref();
  }

  private async turn(): Promise<void> {
    let delayMs = this.failureDelayMs;
    try {
      delayMs = await this.task();
      if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('Invalid background task delay.');
    } catch (error) {
      this.onError(error);
      delayMs = this.failureDelayMs;
    } finally {
      this.running = null;
      if (!this.stopped) {
        this.schedule(this.wakePending ? 0 : delayMs);
        this.wakePending = false;
      }
    }
  }
}
