#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

// Import curated data and baseline computation tools
import { browsers, features, groups, snapshots } from "../index.js";
// Import unified detection API
import { detectFeatures as detectFeaturesUnified } from "../detection-api.js";
// Note: compute-baseline import will be available after build
// import { computeBaseline } from "compute-baseline";

// Use simple string ids for iteration to avoid keyof including symbol
type BrowserId = string;

interface FeatureDetector {
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

// Generate detectors from baseline data
const DETECTORS = generateDetectorsFromBaseline();

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
  for (const file of Array.from(walk(srcDir))) {
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
    blockers: { featureId: string; version: string; baseline: string }[]; // features that set the min version
    baselineStatus?: { baseline: string; details: string };
  }> = {} as any;

  for (const b of browserIds) {
    const needed: string[] = [];
    const missing: string[] = [];
    const versionByFeature: { featureId: string; version: string; baseline: string }[] = [];
    
    for (const fid of Array.from(usedFeatureIds)) {
      const f = (features as any)[fid];
      if (!f || f.kind !== "feature") continue;
      
      // Try to use compute-baseline for more accurate calculations if compat_keys are available
      let version: string | undefined;
      let baseline: string = "unknown";
      
      // TODO: Enable compute-baseline integration after build
      // if (f.compat_features && f.compat_features.length > 0) {
      //   try {
      //     // Use compute-baseline for more accurate calculations
      //     const computed = computeBaseline({ compatKeys: f.compat_features });
      //     const supportMap = computed.support.toJSON();
      //     version = supportMap[b];
      //     baseline = computed.baseline || "false";
      //   } catch (error) {
      //     // Fall back to manual lookup if compute-baseline fails
      //     version = f.status?.support?.[b];
      //     baseline = f.status?.baseline || "false";
      //   }
      // } else {
        // Manual lookup for now
        version = f.status?.support?.[b];
        baseline = f.status?.baseline || "false";
      // }
      
      if (typeof version === "string" && version.length > 0) {
        needed.push(version);
        versionByFeature.push({ featureId: fid, version, baseline });
      } else {
        missing.push(fid);
      }
    }
    
    const min = maxVersion(needed);
    const blockers = min
      ? versionByFeature.filter((x) => compareVersions(x.version, min) === 0)
      : [];
    
    // Calculate overall baseline status for this browser
    const baselineStatus = calculateBaselineStatus(versionByFeature);
    
    perBrowser[b] = { minVersion: min, missing, blockers, baselineStatus };
  }
  return perBrowser;
}

function calculateBaselineStatus(versionByFeature: { featureId: string; version: string; baseline: string }[]) {
  const baselineCounts = { high: 0, low: 0, false: 0 };
  
  for (const feature of versionByFeature) {
    if (feature.baseline === "high") baselineCounts.high++;
    else if (feature.baseline === "low") baselineCounts.low++;
    else baselineCounts.false++;
  }
  
  const total = versionByFeature.length;
  if (total === 0) return { baseline: "unknown", details: "No features detected" };
  
  if (baselineCounts.high / total >= 0.8) {
    return { baseline: "high", details: `${baselineCounts.high}/${total} features are widely available` };
  } else if ((baselineCounts.high + baselineCounts.low) / total >= 0.8) {
    return { baseline: "mixed", details: `${baselineCounts.high + baselineCounts.low}/${total} features are baseline (${baselineCounts.high} widely, ${baselineCounts.low} newly)` };
  } else {
    return { baseline: "low", details: `${baselineCounts.false}/${total} features are not baseline` };
  }
}

function formatOutput(perBrowser: ReturnType<typeof computeRequirements>): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("🎯 Baseline Coverage Audit\n");
  
  // Summary section
  lines.push("📊 SUMMARY");
  const totalFeatures = Object.values(perBrowser)[0]?.blockers?.length || 0;
  lines.push(`Detected Features: ${totalFeatures}`);
  
  const baselineStats = Object.values(perBrowser).map(info => info.baselineStatus?.baseline).filter(Boolean);
  const highBaseline = baselineStats.filter(s => s === "high").length;
  lines.push(`Baseline Compliance: ${highBaseline}/${baselineStats.length} browsers have high baseline coverage`);
  lines.push("");
  
  // Browser details
  lines.push("🌐 BROWSER REQUIREMENTS");
  const header = ["Browser", "Min Version", "Baseline Status"].join("  |  ");
  lines.push(header);
  lines.push("-".repeat(header.length));

  for (const [bid, info] of Object.entries(perBrowser)) {
    const name = (browsers as any)[bid]?.name ?? bid;
    const baselineIcon = getBaselineIcon(info.baselineStatus?.baseline);
    const baselineText = info.baselineStatus?.baseline || "unknown";
    lines.push([name, info.minVersion ?? "n/a", `${baselineIcon} ${baselineText}`].join("  |  "));
  }

  lines.push("");
  
  // Feature details
  lines.push("🔍 DETECTED FEATURES");
  const detectedFeatures = new Set<string>();
  for (const info of Object.values(perBrowser)) {
    info.blockers?.forEach(blocker => detectedFeatures.add(blocker.featureId));
  }
  
  for (const featureId of Array.from(detectedFeatures)) {
    const feature = (features as any)[featureId];
    if (feature) {
      const baselineIcon = getBaselineIcon(feature.status?.baseline);
      lines.push(`  ${baselineIcon} ${feature.name} (${featureId})`);
      if (feature.description) {
        lines.push(`     ${feature.description}`);
      }
      if (feature.caniuse && feature.caniuse.length > 0) {
        lines.push(`     📖 CanIUse: https://caniuse.com/${feature.caniuse[0]}`);
      }
    }
  }

  lines.push("");
  lines.push("💡 NOTES");
  lines.push("• Min Version = earliest browser version that supports all detected features");
  lines.push("• Baseline Status shows overall compatibility with web standards");
  lines.push("• Detection uses patterns generated from baseline data");
  lines.push("• Green ✅ = widely available, Blue 🔵 = newly available, Red ❌ = limited availability");
  lines.push("");
  return lines.join("\n");
}

function getBaselineIcon(baseline?: string): string {
  switch (baseline) {
    case "high": return "✅";
    case "low": return "🔵";
    case "mixed": return "🟡";
    case "false": return "❌";
    default: return "❓";
  }
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

  // Use unified detection API
  const detectionResult = detectFeaturesUnified({ srcDir });
  if (detectionResult.found.size === 0) {
    process.stdout.write("\nNo known features detected. Try adding more detectors or point to a different directory.\n\n");
    process.exit(0);
  }

  const used = detectionResult.found;
  const perBrowser = computeRequirements(used);
  const output = formatOutput(perBrowser);
  process.stdout.write(output);
}

main();
