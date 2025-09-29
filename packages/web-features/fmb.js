#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { browsers, features } from "./index.js";

function printHelp() {
  const help = `\nUsage: fix-my-browse <srcDir> --targets=<list>|--default\n\nExamples:\n  fmb ./src --targets=chrome>=116,firefox>=117,safari>=16.4,edge>=116\n  fmb ./packages/app --default\n\n--default uses a reasonable set of current stable majors (from browsers data).\n`;
  process.stdout.write(help);
}

function parseTargets(arg) {
  if (!arg) return [];
  const items = arg.split(",").map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const item of items) {
    const m = item.match(/^(chrome|chrome_android|edge|firefox|firefox_android|safari|safari_ios)\s*>=\s*([0-9]+(?:\.[0-9]+)*)$/i);
    if (!m) continue;
    out.push({ browser: m[1].toLowerCase(), version: m[2] });
  }
  return out;
}

function defaultTargets() {
  const ids = Object.keys(browsers);
  const out = [];
  for (const id of ids) {
    const rel = (browsers as any)[id]?.releases as { version: string }[] | undefined;
    const latest = rel?.at(-1)?.version;
    if (latest) out.push({ browser: id, version: latest });
  }
  return out;
}

function compareVersions(a, b) {
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

function* walk(dir) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop() as string;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch { continue; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = path.join(current, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) yield full;
    }
  }
}

function extOf(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".js") return "js";
  if (ext === ".ts") return "ts";
  if (ext === ".jsx") return "jsx";
  if (ext === ".tsx") return "tsx";
  if (ext === ".css") return "css";
  return "other";
}

const DETECTORS = [
  { id: "has", fileTypes: ["css","js","ts","jsx","tsx"], patterns: [/\:has\(/] },
  { id: "grid", fileTypes: ["css"], patterns: [/display\s*:\s*grid\b/, /\bgrid-template\b/, /\bgrid-area\b/] },
  { id: "aborting", fileTypes: ["js","ts","jsx","tsx"], patterns: [/\bAbortController\b/, /\bAbortSignal\b/] },
  { id: "async-clipboard", fileTypes: ["js","ts","jsx","tsx"], patterns: [/\bnavigator\.clipboard\b/, /\bClipboardItem\b/] },
];

function detectFeatures(srcDir) {
  const found = new Set();
  for (const file of walk(srcDir)) {
    const ft = extOf(file);
    if (ft === "other") continue;
    let text = "";
    try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
    for (const d of DETECTORS) {
      if (!(d.fileTypes as any).includes(ft)) continue;
      if (d.patterns.some((re) => re.test(text))) found.add(d.id);
    }
  }
  return found;
}

function checkTargets(used, targets) {
  const problems = [];
  for (const t of targets) {
    const blockers = [];
    for (const fid of used) {
      const f = (features as any)[fid];
      if (!f || f.kind !== "feature") continue;
      const required = f.status?.support?.[t.browser];
      if (!required) continue;
      if (compareVersions(t.version, required) < 0) {
        blockers.push({ featureId: fid, required });
      }
    }
    if (blockers.length) problems.push({ browser: t.browser, version: t.version, blockers });
  }
  return problems;
}

function closestSuggestion(fid) {
  const f = (features as any)[fid];
  if (f?.discouraged?.alternatives?.length) return `use alternative(s): ${f.discouraged.alternatives.join(", ")}`;
  if (Array.isArray(f?.caniuse) && f.caniuse.length) return `see caniuse: ${f.caniuse.join(", ")}`;
  return undefined;
}

function formatOutput(problems) {
  if (problems.length === 0) return "\nAll targets satisfied by detected features.\n\n";
  const lines: string[] = [];
  lines.push("");
  lines.push("Fix My Browse (targets check)\n");
  for (const p of problems) {
    lines.push(`${p.browser} >= ${p.version} — blockers:`);
    for (const b of p.blockers) {
      const hint = closestSuggestion(b.featureId);
      lines.push(`  - ${b.featureId} requires ${b.required}${hint ? ` (${hint})` : ""}`);
    }
    lines.push("");
  }
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
  const targetsArg = args.find((a) => a.startsWith("--targets="));
  const useDefault = args.includes("--default");
  const targets = useDefault ? defaultTargets() : parseTargets(targetsArg?.split("=")[1] ?? "");
  if (!targets.length) {
    process.stderr.write("Error: provide --targets=list or --default.\n");
    process.exit(2);
  }
  const used = detectFeatures(srcDir);
  const problems = checkTargets(used, targets);
  process.stdout.write(formatOutput(problems));
}

main();


