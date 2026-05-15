#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..");
const packagesDir = resolve(rootDir, "packages");

const errors: string[] = [];

function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "node_modules") continue;
        results.push(...findFiles(full, extensions));
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch {
    // directory doesn't exist, skip
  }
  return results;
}

// L1 packages (analyzers, ingestion) must not import from interpreter
const L1_PACKAGES = ["analyzers", "ingestion"];
for (const pkg of L1_PACKAGES) {
  const srcDir = resolve(packagesDir, pkg, "src");
  const files = findFiles(srcDir, [".ts"]);

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    if (/from\s+["']@var-ia\/interpreter["']/.test(content)) {
      errors.push(`L1 violation: ${file} imports from @var-ia/interpreter`);
    }
  }
}

// L2 (interpreter) must not import from ingestion (raw data access boundary)
const interpreterSrc = resolve(packagesDir, "interpreter", "src");
const interpreterFiles = findFiles(interpreterSrc, [".ts"]);
for (const file of interpreterFiles) {
  const content = readFileSync(file, "utf-8");
  if (/from\s+["']@var-ia\/ingestion["']/.test(content)) {
    errors.push(`L2 violation: ${file} imports from @var-ia/ingestion`);
  }
  if (/\bMediaWikiClient\b|\bRevisionSource\b|\bDiffFetcher\b/.test(content)) {
    // Skip if in comments or type imports
    if (!/import type/.test(content) || /\bnew\s+MediaWikiClient\b/.test(content)) {
      errors.push(`L2 violation: ${file} references ingestion runtime (MediaWikiClient/RevisionSource/DiffFetcher)`);
    }
  }
}

if (errors.length > 0) {
  console.error("Architecture boundary violations found:");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log("Architecture boundaries clean.");
