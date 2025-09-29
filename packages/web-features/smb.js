#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { features } from "./index.js";

const SPEC_ALIASES = {
  csswg: [/^https?:\/\/drafts\.csswg\.org\//i],
  whatwg: [/^https?:\/\/\w+\.spec\.whatwg\.org\//i, /^https?:\/\/whatwg\.org\//i],
  html: [/^https?:\/\/html\.spec\.whatwg\.org\//i],
  dom: [/^https?:\/\/dom\.spec\.whatwg\.org\//i],
  tc39: [/^https?:\/\/tc39\.es\//i, /^https?:\/\/\w+\.ecma-international\.org\//i],
  wicg: [/^https?:\/\/wicg\.github\.io\//i],
};

function printHelp() {
  const help = `\nUsage: set-my-browse <srcDir> --specs=<list> --mode=allow|deny [--prefer=widely|newly] [--explain]\n\nExamples:\n  smb ./src --specs=csswg,whatwg/dom --mode=allow --prefer=widely\n  smb ./src --specs=wicg --mode=deny --explain\n`;
  process.stdout.write(help);
}

function parseSpecs(list) {
  const parts = list.split(",").map((x) => x.trim()).filter(Boolean);
  const patterns = [];
  for (const p of parts) {
    if (SPEC_ALIASES[p]) {
      patterns.push(...SPEC_ALIASES[p]);
      continue;
    }
    // treat as substring/URL pattern
    try {
      patterns.push(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    } catch {}
  }
  return patterns;
}

function* walk(dir) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
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
      if (!(d.fileTypes || []).includes(ft)) continue;
      if (d.patterns.some((re) => re.test(text))) found.add(d.id);
    }
  }
  return found;
}

function matchesAllowedSpec(specs, patterns) {
  if (!specs || specs.length === 0) return false;
  return specs.some((s) => patterns.some((p) => p.test(s)));
}

function baselineTier(fid) {
  const f = features && features[fid];
  const b = f?.status?.baseline;
  if (b === "high") return "widely";
  if (b === "low") return "newly";
  return "limited";
}

function compliantAlternatives(fid, allowPatterns, prefer) {
  const f = features && features[fid];
  const alts = [];
  // 1) discouraged alternatives if present
  for (const alt of f?.discouraged?.alternatives ?? []) {
    const g = features && features[alt];
    if (!g || g.kind !== "feature") continue;
    if (matchesAllowedSpec(g.spec, allowPatterns)) alts.push(alt);
  }
  // 2) nearby by group
  if (alts.length === 0 && Array.isArray(f?.group)) {
    const groups = new Set(f.group);
    for (const [gid, gf] of Object.entries(features || {})) {
      if (gf && gf.kind !== "feature") continue;
      const groupList = (gf && gf.group) || [];
      if (!groupList.some((g) => groups.has(g))) continue;
      if (matchesAllowedSpec(gf && gf.spec, allowPatterns)) alts.push(gid);
    }
  }
  // order by prefer baseline
  const score = (id) => (baselineTier(id) === prefer ? 0 : baselineTier(id) === "widely" ? 1 : baselineTier(id) === "newly" ? 2 : 3);
  alts.sort((a, b) => score(a) - score(b));
  return Array.from(new Set(alts)).slice(0, 3);
}

function format(fid, explain) {
  if (!explain) return fid;
  const f = features && features[fid];
  const spec = Array.isArray(f?.spec) ? f.spec[0] : undefined;
  const tier = baselineTier(fid);
  return spec ? `${fid} [${tier}] — ${spec}` : `${fid} [${tier}]`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }
  const srcDir = path.resolve(args[0]);
  const specsArg = args.find((a) => a.startsWith("--specs="))?.split("=")[1] ?? "";
  const modeArg = (args.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "allow");
  const prefer = (args.find((a) => a.startsWith("--prefer="))?.split("=")[1] ?? "widely");
  const explain = args.includes("--explain");

  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
    process.stderr.write(`Error: ${srcDir} is not a directory.\n`);
    process.exit(1);
  }
  if (!specsArg) {
    process.stderr.write("Error: --specs is required.\n");
    process.exit(2);
  }
  const patterns = parseSpecs(specsArg);
  const used = detectFeatures(srcDir);
  if (used.size === 0) {
    process.stdout.write("\nNo known features detected.\n\n");
    process.exit(0);
  }

  const compliant = [];
  const noncompliant = [];
  for (const fid of used) {
    const f = features && features[fid];
    if (!f || f.kind !== "feature") continue;
    const ok = matchesAllowedSpec(f.spec, patterns);
    if ((modeArg === "allow" && ok) || (modeArg === "deny" && !ok)) compliant.push(fid);
    else noncompliant.push(fid);
  }

  const lines = [];
  lines.push("");
  lines.push("Set My Browse (spec policy)\n");
  lines.push(`mode: ${modeArg}`);
  lines.push(`policy: ${specsArg}`);
  lines.push("");
  lines.push(`compliant: ${compliant.length}`);
  lines.push(`non-compliant: ${noncompliant.length}`);
  lines.push("");
  if (noncompliant.length) {
    lines.push("Non-compliant features:");
    for (const fid of noncompliant) {
      const alts = compliantAlternatives(fid, patterns, prefer);
      const altText = alts.length ? ` → try: ${alts.map((a) => format(a, explain)).join(", ")}` : "";
      lines.push(`- ${format(fid, explain)}${altText}`);
    }
    lines.push("");
  }

  process.stdout.write(lines.join("\n"));
}

main();


