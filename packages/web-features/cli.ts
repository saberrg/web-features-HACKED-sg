#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// Import curated data (works in TS via tsx and in built JS)
import { browsers, features } from "./index";

// Use simple string ids for iteration to avoid keyof including symbol
type BrowserId = string;

interface Detector {
  id: string; // web-features feature id
  label: string;
  fileTypes: ("js" | "ts" | "jsx" | "tsx" | "css")[];
  patterns: RegExp[];
}

// Minimal MVP detectors: fast, high-signal features
const DETECTORS: Detector[] = [
  {
    id: "has",
    label: "CSS :has() selector",
    fileTypes: ["css", "js", "ts", "jsx", "tsx"],
    patterns: [/\:has\(/],
  },
  {
    id: "grid",
    label: "CSS Grid",
    fileTypes: ["css"],
    patterns: [/display\s*:\s*grid\b/, /\bgrid-template\b/, /\bgrid-area\b/],
  },
  {
    id: "aborting",
    label: "AbortController/AbortSignal",
    fileTypes: ["js", "ts", "jsx", "tsx"],
    patterns: [/\bAbortController\b/, /\bAbortSignal\b/],
  },
  {
    id: "async-clipboard",
    label: "Async Clipboard API",
    fileTypes: ["js", "ts", "jsx", "tsx"],
    patterns: [/\bnavigator\.clipboard\b/, /\bClipboardItem\b/],
  },
  // Add more high-impact detectors here as needed
];

function printHelp(): void {
  const help = `\nUsage: let-me-browse <srcDir>\n\nScans your source code to estimate minimum required browser versions based on detected web features.\n\nExamples:\n  let-me-browse ./src\n`;
  process.stdout.write(help);
}

function* walk(dir: string): Generator<string> {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop() as string;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) {
        continue;
      }
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile()) {
        yield full;
      }
    }
  }
}

function extOf(file: string): "js" | "ts" | "jsx" | "tsx" | "css" | "other" {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".js") return "js";
  if (ext === ".ts") return "ts";
  if (ext === ".jsx") return "jsx";
  if (ext === ".tsx") return "tsx";
  if (ext === ".css") return "css";
  return "other";
}

function detectFeatures(srcDir: string): Set<string> {
  const found = new Set<string>();
  for (const file of walk(srcDir)) {
    const ft = extOf(file);
    if (ft === "other") continue;
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const d of DETECTORS) {
      if (!d.fileTypes.includes(ft as any)) continue;
      for (const re of d.patterns) {
        if (re.test(text)) {
          found.add(d.id);
          break;
        }
      }
    }
  }
  return found;
}

function compareVersions(a: string, b: string): number {
  // Compare version strings like "16.4" vs "15.6" numerically
  const sanitize = (v: string) => v.replace(/[^0-9.]/g, "");
  const as = sanitize(a).split(".").map((n) => parseInt(n, 10));
  const bs = sanitize(b).split(".").map((n) => parseInt(n, 10));
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    const ai = as[i] ?? 0;
    const bi = bs[i] ?? 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

function maxVersion(versions: string[]): string | undefined {
  if (versions.length === 0) return undefined;
  return versions.reduce((max, v) => (compareVersions(v, max) > 0 ? v : max));
}

function computeRequirements(usedFeatureIds: Set<string>) {
  const browserIds = Object.keys(browsers) as BrowserId[];
  const perBrowser: Record<string, {
    minVersion?: string;
    missing: string[]; // features with no declared support for this browser
    blockers: { featureId: string; version: string }[]; // features that set the min version
  }> = {} as any;

  for (const b of browserIds) {
    const needed: string[] = [];
    const missing: string[] = [];
    const versionByFeature: { featureId: string; version: string }[] = [];
    for (const fid of usedFeatureIds) {
      const f = (features as any)[fid];
      if (!f || f.kind !== "feature") continue;
      const v = f.status?.support?.[b];
      if (typeof v === "string" && v.length > 0) {
        needed.push(v);
        versionByFeature.push({ featureId: fid, version: v });
      } else {
        missing.push(fid);
      }
    }
    const min = maxVersion(needed);
    const blockers = min
      ? versionByFeature.filter((x) => compareVersions(x.version, min) === 0)
      : [];
    perBrowser[b] = { minVersion: min, missing, blockers };
  }
  return perBrowser;
}

function formatOutput(perBrowser: ReturnType<typeof computeRequirements>): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("Baseline Coverage Audit\n");
  const header = ["Browser", "Min Version"].join("  |  ");
  lines.push(header);
  lines.push("-".repeat(header.length));

  for (const [bid, info] of Object.entries(perBrowser)) {
    const name = (browsers as any)[bid]?.name ?? bid;
    lines.push([name, info.minVersion ?? "n/a"].join("  |  "));
  }

  lines.push("");
  lines.push("Min Version = earliest browser version that supports all detected features found.");
  lines.push("Detection is heuristic (MVP). Add more detectors to improve coverage.");
  lines.push("");
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const srcDir = path.resolve(args[0]);
  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
    process.stderr.write(`Error: ${srcDir} is not a directory.\n`);
    process.exit(1);
  }

  const used = detectFeatures(srcDir);
  if (used.size === 0) {
    process.stdout.write("\nNo known features detected. Try adding more detectors or point to a different directory.\n\n");
    process.exit(0);
  }

  const perBrowser = computeRequirements(used);
  const output = formatOutput(perBrowser);
  process.stdout.write(output);
}

main();


