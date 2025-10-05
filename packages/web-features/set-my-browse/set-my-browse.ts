#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

import { features, groups, snapshots } from "../index.js";
// Import unified detection API
import { detectFeatures as detectFeaturesUnified } from "../detection-api.js";
// Note: compute-baseline import will be available after build
// import { computeBaseline } from "compute-baseline";

type Mode = "allow" | "deny";

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

interface AlternativeSuggestion {
  featureId: string;
  name: string;
  description: string;
  baseline: string;
  reason: string;
  caniuse?: string[];
  spec?: string[];
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
  const help = `\nUsage: set-my-browse <srcDir> --specs=<list> --mode=allow|deny [--prefer=widely|newly] [--explain]\n\nExamples:\n  smb ./src --specs=csswg,whatwg/dom --mode=allow --prefer=widely\n  smb ./src --specs=wicg --mode=deny --explain\n`;
  process.stdout.write(help);
}

function parseSpecs(arg?: string): string[] {
  if (!arg) return [];
  return arg.split(",").map((x) => x.trim()).filter(Boolean);
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

function detectFeatures(srcDir: string): Set<string> {
  const found = new Set<string>();
  for (const file of Array.from(walk(srcDir))) {
    const ft = extOf(file);
    if (ft === "other") continue;
    let text = "";
    try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
    for (const d of DETECTORS) {
      if (!d.fileTypes.includes(ft as any)) continue;
      if (d.patterns.some((re) => re.test(text))) found.add(d.id);
    }
  }
  return found;
}

function isBetterBaseline(current: string | false, prefer: string): boolean {
  if (prefer === "widely") return current === "high";
  if (prefer === "newly") return current === "low";
  return false;
}

function extractSearchTerms(feature: any): string[] {
  const terms: string[] = [];
  if (feature.name) terms.push(feature.name.toLowerCase());
  if (feature.description) terms.push(...feature.description.toLowerCase().split(/\s+/));
  return terms.filter(term => term.length > 3);
}

function hasSimilarFunctionality(currentFeature: any, candidateFeature: any): boolean {
  const currentTerms = extractSearchTerms(currentFeature);
  const candidateTerms = extractSearchTerms(candidateFeature);
  
  // Check for overlapping terms (simple similarity)
  const overlap = currentTerms.filter(term => candidateTerms.includes(term));
  return overlap.length >= 2; // At least 2 overlapping terms
}

function compliantAlternatives(fid: string, specs: string[], mode: Mode, prefer?: string): AlternativeSuggestion[] {
  const alternatives: AlternativeSuggestion[] = [];
  const feature = (features as any)[fid];
  if (!feature) return alternatives;
  
  // Get discouraged alternatives first (highest priority)
  if (feature.discouraged?.alternatives) {
    for (const altId of feature.discouraged.alternatives) {
      const alt = (features as any)[altId];
      if (alt && alt.kind === "feature") {
        const isCompliant = mode === "allow" ? 
          specs.some(spec => alt.spec?.some((s: string) => s.includes(spec))) :
          !specs.some(spec => alt.spec?.some((s: string) => s.includes(spec)));
        
        if (isCompliant) {
          const baseline = alt.status?.baseline || "false";
          const reason = prefer && isBetterBaseline(baseline, prefer) ? 
            `Better baseline status (${baseline} vs ${feature.status?.baseline || "false"})` :
            "Discouraged alternative";
          
          alternatives.push({
            featureId: altId,
            name: alt.name,
            description: alt.description,
            baseline: baseline.toString(),
            reason,
            caniuse: alt.caniuse,
            spec: alt.spec
          });
        }
      }
    }
  }
  
  // Find features from the same group
  if (feature.group) {
    for (const groupId of feature.group) {
      const group = (groups as any)[groupId];
      if (group?.features) {
        for (const groupFeatureId of group.features) {
          if (groupFeatureId === fid) continue; // Skip the current feature
          
          const groupFeature = (features as any)[groupFeatureId];
          if (groupFeature && groupFeature.kind === "feature") {
            const isCompliant = mode === "allow" ? 
              specs.some(spec => groupFeature.spec?.some((s: string) => s.includes(spec))) :
              !specs.some(spec => groupFeature.spec?.some((s: string) => s.includes(spec)));
            
            if (isCompliant) {
              const baseline = groupFeature.status?.baseline || "false";
              const reason = prefer && isBetterBaseline(baseline, prefer) ? 
                `Better baseline status from same group (${baseline})` :
                "Feature from same group";
              
              alternatives.push({
                featureId: groupFeatureId,
                name: groupFeature.name,
                description: groupFeature.description,
                baseline: baseline.toString(),
                reason,
                caniuse: groupFeature.caniuse,
                spec: groupFeature.spec
              });
            }
          }
        }
      }
    }
  }
  
  // Find similar functionality (last resort)
  for (const [candidateId, candidateFeature] of Object.entries(features)) {
    if (candidateId === fid) continue;
    
    const candidate = candidateFeature as any;
    if (candidate.kind !== "feature") continue;
    
    const isCompliant = mode === "allow" ? 
      specs.some(spec => candidate.spec?.some((s: string) => s.includes(spec))) :
      !specs.some(spec => candidate.spec?.some((s: string) => s.includes(spec)));
    
    if (isCompliant && hasSimilarFunctionality(feature, candidate)) {
      const baseline = candidate.status?.baseline || "false";
      const reason = prefer && isBetterBaseline(baseline, prefer) ? 
        `Similar functionality with better baseline (${baseline})` :
        "Similar functionality";
      
      alternatives.push({
        featureId: candidateId,
        name: candidate.name,
        description: candidate.description,
        baseline: baseline.toString(),
        reason,
        caniuse: candidate.caniuse,
        spec: candidate.spec
      });
    }
  }
  
  // Sort by preference and baseline status
  return alternatives.sort((a, b) => {
    // Prioritize better baseline status if prefer is specified
    if (prefer && a.baseline !== b.baseline) {
      const aBetter = isBetterBaseline(a.baseline as any, prefer);
      const bBetter = isBetterBaseline(b.baseline as any, prefer);
      if (aBetter && !bBetter) return -1;
      if (!aBetter && bBetter) return 1;
    }
    
    // Then by baseline status (high > low > false)
    const baselineOrder: Record<string, number> = { "high": 0, "low": 1, "false": 2 };
    const aOrder = baselineOrder[a.baseline] || 3;
    const bOrder = baselineOrder[b.baseline] || 3;
    return aOrder - bOrder;
  }).slice(0, 5); // Limit to top 5 suggestions
}

function format(fid: string, specs: string[], mode: Mode, prefer?: string, explain?: boolean): string {
  const feature = (features as any)[fid];
  if (!feature) return `Unknown feature: ${fid}`;
  
  const baselineIcon = getBaselineIcon(feature.status?.baseline);
  const isCompliant = mode === "allow" ? 
    specs.some(spec => feature.spec?.some((s: string) => s.includes(spec))) :
    !specs.some(spec => feature.spec?.some((s: string) => s.includes(spec)));
  
  const lines: string[] = [];
  lines.push(`  ${baselineIcon} ${feature.name} (${fid})`);
  lines.push(`     Status: ${isCompliant ? "✅ Compliant" : "❌ Non-compliant"} with ${mode} policy`);
  lines.push(`     Baseline: ${feature.status?.baseline || "false"}`);
  
  if (explain) {
    if (feature.description) {
      lines.push(`     Description: ${feature.description}`);
    }
    if (feature.spec && feature.spec.length > 0) {
      lines.push(`     Spec: ${feature.spec.join(", ")}`);
    }
    if (feature.caniuse && feature.caniuse.length > 0) {
      lines.push(`     CanIUse: https://caniuse.com/${feature.caniuse[0]}`);
    }
  }
  
  if (!isCompliant) {
    const alternatives = compliantAlternatives(fid, specs, mode, prefer);
    if (alternatives.length > 0) {
      lines.push(`     Suggested alternatives:`);
      for (const alt of alternatives.slice(0, 3)) { // Show top 3
        const altBaselineIcon = getBaselineIcon(alt.baseline);
        lines.push(`       ${altBaselineIcon} ${alt.name} (${alt.featureId})`);
        lines.push(`          ${alt.reason}`);
        if (explain && alt.caniuse && alt.caniuse.length > 0) {
          lines.push(`          CanIUse: https://caniuse.com/${alt.caniuse[0]}`);
        }
      }
    }
  }
  
  return lines.join("\n");
}

function getBaselineIcon(baseline?: string | false): string {
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
  
  const specsArg = args.find((a) => a.startsWith("--specs="));
  const modeArg = args.find((a) => a.startsWith("--mode="));
  const preferArg = args.find((a) => a.startsWith("--prefer="));
  const explain = args.includes("--explain");
  
  const specs = parseSpecs(specsArg?.split("=")[1]);
  const mode = modeArg?.split("=")[1] as Mode;
  
  if (!specs.length || !mode) {
    process.stderr.write("Error: provide --specs=list and --mode=allow|deny.\n");
    process.exit(2);
  }
  
  if (mode !== "allow" && mode !== "deny") {
    process.stderr.write("Error: --mode must be 'allow' or 'deny'.\n");
    process.exit(2);
  }
  
  const prefer = preferArg?.split("=")[1];
  if (prefer && prefer !== "widely" && prefer !== "newly") {
    process.stderr.write("Error: --prefer must be 'widely' or 'newly'.\n");
    process.exit(2);
  }
  
  // Use unified detection API
  const detectionResult = detectFeaturesUnified({ srcDir });
  const used = detectionResult.found;
  const nonCompliant = new Set<string>();
  const compliant = new Set<string>();
  
  for (const fid of used) {
    const feature = (features as any)[fid];
    if (!feature || feature.kind !== "feature") continue;
    
    const isCompliant = mode === "allow" ? 
      specs.some(spec => feature.spec?.some((s: string) => s.includes(spec))) :
      !specs.some(spec => feature.spec?.some((s: string) => s.includes(spec)));
    
    if (isCompliant) {
      compliant.add(fid);
    } else {
      nonCompliant.add(fid);
    }
  }
  
  const lines: string[] = [];
  lines.push("");
  lines.push("🎯 Set My Browse - Policy Compliance Report\n");
  lines.push(`Policy: ${mode} features from specs: ${specs.join(", ")}`);
  lines.push(`Preference: ${prefer || "none"}`);
  lines.push("");
  
  const totalFeatures = used.size;
  const compliantCount = compliant.size;
  const nonCompliantCount = nonCompliant.size;
  const complianceRate = totalFeatures > 0 ? Math.round((compliantCount / totalFeatures) * 100) : 100;
  
  lines.push("📊 SUMMARY");
  lines.push(`Total Features Detected: ${totalFeatures}`);
  lines.push(`Compliant: ${compliantCount} (${complianceRate}%)`);
  lines.push(`Non-compliant: ${nonCompliantCount} (${100 - complianceRate}%)`);
  lines.push("");
  
  if (compliantCount > 0) {
    lines.push("✅ COMPLIANT FEATURES");
    for (const fid of Array.from(compliant)) {
      lines.push(format(fid, specs, mode, prefer, explain));
    }
    lines.push("");
  }
  
  if (nonCompliantCount > 0) {
    lines.push("❌ NON-COMPLIANT FEATURES");
    for (const fid of Array.from(nonCompliant)) {
      lines.push(format(fid, specs, mode, prefer, explain));
    }
    lines.push("");
  }
  
  lines.push("💡 NOTES");
  lines.push(`• Policy: ${mode} features from specified specs`);
  lines.push(`• Baseline icons: ✅ widely available, 🔵 newly available, ❌ limited availability`);
  lines.push(`• Use --explain for detailed information about each feature`);
  if (prefer) {
    lines.push(`• Preference: ${prefer === "widely" ? "prioritizing widely available alternatives" : "prioritizing newly available alternatives"}`);
  }
  lines.push("");
  
  process.stdout.write(lines.join("\n"));
}

main();
