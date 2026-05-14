import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { sendNotifications } from "../notify.js";

describe("notify", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubEnv("SLACK_WEBHOOK_URL", "");
    vi.stubEnv("SMTP_TO", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does nothing when no deltas have changes", async () => {
    const deltas = [{ pageTitle: "Earth", eventsNew: 0, eventsResolved: 0, deltaSummary: "no changes" }];
    await sendNotifications({ slack: true }, deltas);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does nothing when deltas array is empty", async () => {
    await sendNotifications({ slack: true }, []);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends slack notification with changed deltas", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/test");
    mockFetch.mockResolvedValue({ ok: true });

    const deltas = [{ pageTitle: "Earth", eventsNew: 3, eventsResolved: 1, deltaSummary: "3 new, 1 resolved" }];
    await sendNotifications({ slack: true }, deltas);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0][0];
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callUrl).toBe("https://hooks.slack.com/test");
    expect(callBody.text).toContain("Earth");
    expect(callBody.text).toContain("3 new");
  });

  it("sends webhook notification with JSON payload", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const deltas = [{ pageTitle: "Mars", eventsNew: 1, eventsResolved: 0, deltaSummary: "1 new" }];
    await sendNotifications({ webhookUrl: "https://example.com/webhook" }, deltas);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.event).toBe("varia.observation");
    expect(callBody.pages[0].pageTitle).toBe("Mars");
    expect(callBody.totalNewEvents).toBe(1);
  });

  it("handles multiple notification channels", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/test");
    mockFetch.mockResolvedValue({ ok: true });

    const deltas = [{ pageTitle: "Earth", eventsNew: 2, eventsResolved: 0, deltaSummary: "2 new" }];
    await sendNotifications({ slack: true, webhookUrl: "https://example.com/hook" }, deltas);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("logs warning when slack requested but no webhook URL configured", async () => {
    const warnSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const deltas = [{ pageTitle: "Earth", eventsNew: 1, eventsResolved: 0, deltaSummary: "1 new" }];
    await sendNotifications({ slack: true }, deltas);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SLACK_WEBHOOK_URL"),
    );
    warnSpy.mockRestore();
  });
});
