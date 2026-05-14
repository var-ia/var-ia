export class RateLimiter {
  private nextSlot: number;

  constructor(private minDelayMs: number = 100) {
    this.nextSlot = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    let slot: number;

    if (this.nextSlot <= now) {
      slot = now;
      this.nextSlot = now + this.minDelayMs;
    } else {
      slot = this.nextSlot;
      this.nextSlot += this.minDelayMs;
    }

    const waitMs = slot - now;
    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
