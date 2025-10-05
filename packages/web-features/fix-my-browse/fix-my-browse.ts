#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

import { browsers, features } from "../index.js";
import { detectFeatures as detectFeaturesUnified } from "../detection-api.js";

type BrowserId = string;

interface Target {
  browser: BrowserId;
  version: string;
}

interface FeatureDetector {
  id: string;
  name: string;
  description: string;
  fileTypes: ("js" | "ts" | "jsx" | "tsx" | "css")[];
  patterns: RegExp[];
  compatKeys?: string[];
  baseline?: "high" | "low" | false;
  alternatives?: string[];
  caniuse?: string[];
  group?: string[];
}

function printHelp(): void {
  const help = `\nUsage: fix-my-browse <srcDir> --targets=<list>|--default\n\nExamples:\n  fmb ./src --targets=chrome>=116,firefox>=117,safari>=16.4,edge>=116\n  fmb ./packages/app --default\n\n--default uses a reasonable set of current stable majors (from browsers data).\n`;
  process.stdout.write(help);
}

function parseTargets(arg?: string): Target[] {
  if (!arg) return [];
  const items = arg.split(",").map((x) => x.trim()).filter(Boolean);
  const out: Target[] = [];
  for (const item of items) {
    const m = item.match(/^(chrome|chrome_android|edge|firefox|firefox_android|safari|safari_ios)\s*>=\s*([0-9]+(?:\.[0-9]+)*)$/i);
    if (!m) continue;
    out.push({ browser: m[1].toLowerCase(), version: m[2] });
  }
  return out;
}

function defaultTargets(): Target[] {
  const ids = Object.keys(browsers) as BrowserId[];
  const out: Target[] = [];
  for (const id of ids) {
    const rel = (browsers as any)[id]?.releases as { version: string }[] | undefined;
    const latest = rel?.at(-1)?.version;
    if (latest) out.push({ browser: id, version: latest });
  }
  return out;
}

function compareVersions(a: string, b: string): number {
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

function* walk(dir: string): Generator<string> {
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

function extOf(file: string): "js" | "ts" | "jsx" | "tsx" | "css" | "other" {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".js") return "js";
  if (ext === ".ts") return "ts";
  if (ext === ".jsx") return "jsx";
  if (ext === ".tsx") return "tsx";
  if (ext === ".css") return "css";
  return "other";
}

// Detector generation from baseline data
function generateDetectorsFromBaseline(): FeatureDetector[] {
  const detectors: FeatureDetector[] = [];
  
  for (const [featureId, feature] of Object.entries(features)) {
    if ((feature as any).kind !== "feature") continue;
    
    // Generate patterns based on feature type and name
    const patterns = generatePatternsFromFeature(featureId, feature);
    if (patterns.length === 0) continue;
    
    // Determine file types based on feature characteristics
    const fileTypes = determineFileTypes(featureId, feature);
    
    detectors.push({
      id: featureId,
      name: (feature as any).name,
      description: (feature as any).description,
      fileTypes,
      patterns,
      compatKeys: (feature as any).compat_features,
      baseline: (feature as any).status?.baseline,
      alternatives: (feature as any).discouraged?.alternatives,
      caniuse: (feature as any).caniuse,
      group: (feature as any).group
    });
  }
  
  // Sort by baseline status (high priority features first)
  return detectors.sort((a, b) => {
    const baselineOrder: Record<string, number> = { "high": 0, "low": 1, "false": 2 };
    const aBaseline = a.baseline === false ? "false" : a.baseline || "unknown";
    const bBaseline = b.baseline === false ? "false" : b.baseline || "unknown";
    return (baselineOrder[aBaseline] || 3) - (baselineOrder[bBaseline] || 3);
  });
}

function generatePatternsFromFeature(featureId: string, feature: any): RegExp[] {
  const patterns: RegExp[] = [];
  const name = feature.name.toLowerCase();
  const description = feature.description.toLowerCase();
  
  // CSS Selectors
  if (featureId.includes("has") || name.includes(":has")) {
    patterns.push(/\:has\(/);
  }
  if (featureId.includes("grid") || name.includes("grid")) {
    patterns.push(/display\s*:\s*grid\b/, /\bgrid-template\b/, /\bgrid-area\b/, /\bgrid-column\b/, /\bgrid-row\b/);
  }
  if (featureId.includes("flexbox") || name.includes("flex")) {
    patterns.push(/display\s*:\s*flex\b/, /\bflex-direction\b/, /\bflex-wrap\b/, /\bjustify-content\b/, /\balign-items\b/);
  }
  if (featureId.includes("container-queries") || name.includes("container")) {
    patterns.push(/@container\b/, /\bcontainer-type\b/, /\bcontainer-name\b/);
  }
  
  // JavaScript APIs
  if (featureId.includes("aborting") || name.includes("abort")) {
    patterns.push(/\bAbortController\b/, /\bAbortSignal\b/);
  }
  if (featureId.includes("async-clipboard") || name.includes("clipboard")) {
    patterns.push(/\bnavigator\.clipboard\b/, /\bClipboardItem\b/);
  }
  if (featureId.includes("fetch") || name.includes("fetch")) {
    patterns.push(/\bfetch\s*\(/, /\bResponse\b/, /\bRequest\b/);
  }
  if (featureId.includes("promise") || name.includes("promise")) {
    patterns.push(/\bPromise\b/, /\b\.then\b/, /\b\.catch\b/, /\b\.finally\b/, /\basync\s+function/, /\bawait\s+/);
  }
  if (featureId.includes("async-iterators") || name.includes("async iterator")) {
    patterns.push(/for\s+await\s*\(/, /\basync\s+\*\s*/, /\byield\s+/);
  }
  if (featureId.includes("modules") || name.includes("import") || name.includes("export")) {
    patterns.push(/import\s+/, /export\s+/, /from\s+['"`]/);
  }
  
  // Web APIs
  if (featureId.includes("web-components") || name.includes("custom element")) {
    patterns.push(/\bcustomElements\b/, /\bdefine\s*\(/, /\bconnectedCallback\b/, /\bdisconnectedCallback\b/);
  }
  if (featureId.includes("intersection-observer") || name.includes("intersection")) {
    patterns.push(/\bIntersectionObserver\b/);
  }
  if (featureId.includes("mutation-observer") || name.includes("mutation")) {
    patterns.push(/\bMutationObserver\b/);
  }
  
  return patterns;
}

function determineFileTypes(featureId: string, feature: any): ("js" | "ts" | "jsx" | "tsx" | "css")[] {
  const fileTypes: ("js" | "ts" | "jsx" | "tsx" | "css")[] = [];
  
  if (featureId.startsWith("css") || featureId.includes("css-")) {
    fileTypes.push("css");
  }
  
  if (featureId.startsWith("javascript") || featureId.includes("js-") || 
      featureId.includes("api") || featureId.includes("web-") ||
      featureId.includes("dom") || featureId.includes("html")) {
    fileTypes.push("js", "ts", "jsx", "tsx");
  }
  
  // Some features can appear in both CSS and JS (like CSS-in-JS)
  if (featureId.includes("css") && (featureId.includes("js") || featureId.includes("api"))) {
    fileTypes.push("js", "ts", "jsx", "tsx");
  }
  
  return fileTypes.length > 0 ? fileTypes : ["js", "ts", "jsx", "tsx", "css"];
}

interface EnhancedDetector {
  id: string; // web-features feature id
  name: string;
  description: string;
  fileTypes: ("js" | "ts" | "jsx" | "tsx" | "css")[];
  patterns: RegExp[];
  compatKeys?: string[];
  baseline?: "high" | "low" | false;
  alternatives?: string[];
  caniuse?: string[];
  group?: string[];
}

// Generate detectors from baseline data
const DETECTORS = generateDetectorsFromBaseline();

function detectFeatures(srcDir: string): Set<string> {
  const found = new Set<string>();
  for (const file of Array.from(walk(srcDir))) {
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

function checkTargets(used: Set<string>, targets: Target[]) {
  const problems: { browser: BrowserId; version: string; blockers: { featureId: string; required: string }[] }[] = [];
  for (const t of targets) {
    const blockers: { featureId: string; required: string }[] = [];
    for (const fid of Array.from(used)) {
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

function closestSuggestion(fid: string): string | undefined {
  const f = (features as any)[fid];
  if (f?.discouraged?.alternatives?.length) return `use alternative(s): ${f.discouraged.alternatives.join(", ")}`;
  if (Array.isArray(f?.caniuse) && f.caniuse.length) return `see caniuse: ${f.caniuse.join(", ")}`;
  return undefined;
}

function formatOutput(problems: ReturnType<typeof checkTargets>): string {
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
  // Use unified detection API
  const detectionResult = detectFeaturesUnified({ srcDir });
  const used = detectionResult.found;
  const problems = checkTargets(used, targets);
  process.stdout.write(formatOutput(problems));
}

main();
