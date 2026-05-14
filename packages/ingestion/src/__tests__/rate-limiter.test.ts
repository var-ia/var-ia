import { describe, expect, it } from "vitest";
import { RateLimiter } from "../rate-limiter.js";

describe("RateLimiter", () => {
  it("acquires without error", async () => {
    const limiter = new RateLimiter(1);
    await limiter.acquire();
  });

  it("acquires multiple times sequentially", async () => {
    const limiter = new RateLimiter(1);
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
  });

  it("enforces minimum delay between acquires", async () => {
    const limiter = new RateLimiter(50);
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });

  it("accepts custom delay", async () => {
    const limiter = new RateLimiter(10);
    await limiter.acquire();
  });
});
