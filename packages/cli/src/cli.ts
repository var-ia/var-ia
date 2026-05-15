import { cli } from "./index.js";

cli(process.argv.slice(2)).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("API key") || msg.includes("api_key") || msg.includes("Authorization")) {
    console.error("wikihistory: authentication error — check your API credentials");
  } else if (msg.includes("@refract-org/persistence")) {
    console.error("wikihistory:", msg);
  } else {
    console.error("wikihistory:", msg);
  }
  process.exit(1);
});
