// check:clean — anti-leak guard for the public repo.
//
// Greps the entire package source (excluding node_modules/, dist/,
// src/generated/) for patterns that must never appear in a public repository:
//   - Internal spec/doc reference codes: FR-N, AC-N, NFR-N, TS-N, ADR-N
//   - Internal path prefixes: sdk/N, api/N, core/N, infra/N, mcp/N
//   - Internal doc paths: docs/specs, docs/adr
//   - Issue tracker refs: #NNN (3+ digit issue numbers)
//   - Internal policy labels: "Hard Rule" (case-insensitive)
//   - Internal codenames/paths: redarc, rdc_ (not rdc_ in api keys), @curviate/shared, apps/server
//   - Substrate vendor name (assembled from fragments to avoid the literal appearing here)
//
// Scans both extensioned source files (see SCAN_EXTS) and a fixed allowlist
// of extensionless dotfiles (see SCAN_DOTFILES, e.g. .gitignore) — the latter
// exist because Node's path.extname() reports no extension for them
// (extname(".gitignore") === ""), so the extension-based filter alone would
// silently skip a leak sitting in a comment inside one of these files.
//
// Exits 0 when clean, non-zero and prints every offending line when not.
// Wire this as `pnpm check:clean` and invoke it from the prepack / verify:dist flow.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");

// Directories to skip entirely (relative to pkgRoot).
const SKIP_DIRS = new Set(["node_modules", "dist", "src/generated"]);

// File extensions to scan.
const SCAN_EXTS = new Set([".ts", ".mjs", ".js", ".md", ".json"]);

// Extensionless dotfiles to scan explicitly, matched by exact basename
// (SCAN_EXTS can't catch these — see the module header comment).
const SCAN_DOTFILES = new Set([".gitignore", ".npmrc", ".nvmrc", ".env.example", ".editorconfig"]);

// The vendor name assembled from parts so the literal never appears in this file.
const vendorName = ["uni", "pi", "le"].join("");

/** @type {Array<{ label: string; pattern: RegExp }>} */
const PATTERNS = [
  {
    label: "internal spec/doc refs (FR-N, AC-N, NFR-N, TS-N, ADR-N)",
    // Matches: FR-001, AC-003, NFR-001, TS-005, ADR-033
    pattern: /\b(FR|AC|NFR|TS|ADR)-\d+/,
  },
  {
    label: "internal path prefixes (sdk/N, api/N, core/N, infra/N, mcp/N)",
    // Matches: sdk/001, api/003, core/002, infra/006, mcp/007
    pattern: /\b(sdk|api|core|infra|mcp)\/\d+/,
  },
  {
    label: "internal doc paths (docs/specs, docs/adr)",
    pattern: /docs\/(specs|adr)\b/,
  },
  {
    label: "issue tracker refs (#NNN — 3+ digit numbers)",
    // Matches: #288, #123 — but not #12 (2-digit) or markdown list items like "# heading".
    pattern: /#\d{3,}/,
  },
  {
    label: "internal policy labels (Hard Rule)",
    pattern: /hard\s+rule/i,
  },
  {
    label: "internal codenames (redarc, @curviate/shared, apps/server)",
    pattern: /\b(redarc|@curviate\/shared|apps\/server)\b/,
  },
  {
    label: "internal key prefix (rdc_ — not a customer key format)",
    // rdc_live_ or rdc_test_ but never cvt_live_ which is the customer prefix.
    pattern: /\brdc_(?!live_)/,
  },
  {
    label: "substrate vendor name",
    pattern: new RegExp(vendorName, "i"),
  },
];

/**
 * Recursively collect files under `dir`, skipping SKIP_DIRS.
 * @param {string} dir absolute path
 * @returns {Promise<string[]>} absolute file paths
 */
async function collectFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const rel = relative(pkgRoot, abs);
    if (entry.isDirectory()) {
      // Skip directories in the exclusion set (check both the name and relative path).
      if (SKIP_DIRS.has(entry.name) || SKIP_DIRS.has(rel)) continue;
      results.push(...(await collectFiles(abs)));
    } else if (
      entry.isFile() &&
      (SCAN_EXTS.has(extname(entry.name)) || SCAN_DOTFILES.has(entry.name))
    ) {
      results.push(abs);
    }
  }
  return results;
}

const files = await collectFiles(pkgRoot);
let totalHits = 0;

for (const file of files) {
  const rel = relative(pkgRoot, file);
  // Skip this script itself (it deliberately contains pattern fragments).
  if (rel === "scripts/check-clean.mjs") continue;

  let content;
  try {
    content = await readFile(file, "utf8");
  } catch {
    continue;
  }

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { label, pattern } of PATTERNS) {
      if (pattern.test(line)) {
        console.error(`LEAK  ${rel}:${i + 1}  [${label}]`);
        console.error(`      ${line.trim()}`);
        totalHits++;
        break; // one label per line is enough
      }
    }
  }
}

if (totalHits > 0) {
  console.error(`\ncheck:clean FAIL — ${totalHits} leak(s) found. Strip the references above before publishing.`);
  process.exit(1);
}

console.error("check:clean OK — no internal references found.");
