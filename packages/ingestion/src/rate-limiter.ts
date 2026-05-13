export class RateLimiter {
  private lastRequestTime = 0;
  private queue: Array<() => void> = [];
  private processing = false;

  constructor(private minDelayMs: number = 100) {}

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      if (!this.processing) this.process();
    });
  }

  private async process(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < this.minDelayMs) {
        await this.sleep(this.minDelayMs - elapsed);
      }
      this.lastRequestTime = Date.now();
      const next = this.queue.shift()!;
      next();
    }
    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
