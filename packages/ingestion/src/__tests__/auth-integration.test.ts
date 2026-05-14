import { describe, expect, it } from "vitest";
import { MediaWikiClient } from "../mediawiki-client.js";

const AUTH_API_URL = "http://localhost:8081/w/api.php";
const TEST_PAGE = "Main Page";

const dockerAvailable = !!process.env.DOCKER_TESTS;

describe.runIf(dockerAvailable)("Auth integration (DOCKER_TESTS)", () => {
  it("fails without auth when wiki requires authentication", { timeout: 15000 }, async () => {
    const client = new MediaWikiClient({ apiUrl: AUTH_API_URL, minDelayMs: 0 });

    await expect(client.fetchRevisions(TEST_PAGE, { limit: 1 })).rejects.toThrow();
  });

  it("succeeds with basic auth (apiUser + apiPassword)", { timeout: 15000 }, async () => {
    const client = new MediaWikiClient({
      apiUrl: AUTH_API_URL,
      minDelayMs: 0,
      auth: {
        apiUser: "testuser",
        apiPassword: "testpass123!",
      },
    });

    const revisions = await client.fetchRevisions(TEST_PAGE, { limit: 1 });
    expect(revisions.length).toBeGreaterThan(0);
    expect(revisions[0].revId).toBeGreaterThan(0);
  });

  it("succeeds with bearer token (apiKey)", { timeout: 15000 }, async () => {
    const client = new MediaWikiClient({
      apiUrl: AUTH_API_URL,
      minDelayMs: 0,
      auth: {
        apiKey: "test-token-for-bearer-auth",
      },
    });

    const revisions = await client.fetchRevisions(TEST_PAGE, { limit: 1 });
    expect(revisions.length).toBeGreaterThan(0);
    expect(revisions[0].revId).toBeGreaterThan(0);
  });

  it("succeeds with OAuth2 env vars", { timeout: 15000 }, async () => {
    const client = new MediaWikiClient({
      apiUrl: AUTH_API_URL,
      minDelayMs: 0,
      auth: {
        oauthClientId: "test-client-id",
        oauthClientSecret: "test-client-secret",
      },
    });

    const revisions = await client.fetchRevisions(TEST_PAGE, { limit: 1 });
    expect(revisions.length).toBeGreaterThan(0);
    expect(revisions[0].revId).toBeGreaterThan(0);
  });
});
