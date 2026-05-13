#!/usr/bin/env node
import { cli } from "./index.js";

cli(process.argv.slice(2)).catch((err) => {
  console.error("wikihistory: fatal error:", err.message);
  process.exit(1);
});
