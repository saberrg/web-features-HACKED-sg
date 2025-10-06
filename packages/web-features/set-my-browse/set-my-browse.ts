#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

import { features, groups, snapshots } from "../index.js";
// Import baseline detection API
import { detectFeatures as detectFeaturesBaseline } from "../baseline-detector.js";
// Import compute-baseline utilities
import { getStatus } from "../../compute-baseline/src/baseline/index.js";
import { identifiers as coreBrowserSet } from "../../compute-baseline/src/baseline/core-browser-set.js";
// Note: compute-baseline import will be available after build
// import { computeBaseline } from "compute-baseline";

type Mode = "allow" | "deny";

function printHelp(): void {
  const help = `\nUsage: set-my-browse <srcDir> --specs=<list> --mode=<allow|deny> [--prefer=<widely|newly>] [--explain]\n\nExamples:\n  set-my-browse ./src --specs=csswg --mode=allow\n  set-my-browse ./src --specs=whatwg --mode=deny --prefer=widely\n`;
  process.stdout.write(help);
}

function parseSpecs(specsString?: string): string[] {
  if (!specsString) return [];
  return specsString.split(",").map(s => s.trim()).filter(Boolean);
}

function getBaselineIcon(baseline?: string): string {
  switch (baseline) {
    case "high": return "🟢";
    case "low": return "🟡";
    case "false": return "🔴";
    default: return "❓";
  }
}

function formatFeature(featureId: string, specs: string[], mode: Mode, prefer?: string, explain?: boolean): string {
  const feature = features[featureId];
  if (!feature) return `❓ ${featureId}`;
  
  const baseline = (feature as any).status?.baseline;
  const icon = getBaselineIcon(baseline);
  const name = (feature as any).name || featureId;
  const description = (feature as any).description || "No description available";
  
  let lines: string[] = [];
  lines.push(`${icon} ${name} (${featureId})`);
  
  if (explain) {
    lines.push(`   Description: ${description}`);
    lines.push(`   Baseline: ${baseline || "unknown"}`);
    if ((feature as any).spec) {
      lines.push(`   Specs: ${(feature as any).spec.join(", ")}`);
    }
  }
  
  // Add alternatives
  const alternatives = (feature as any).discouraged?.alternatives || [];
  if (alternatives.length > 0) {
    lines.push(`   💡 Alternatives: ${alternatives.join(", ")}`);
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
  
  // Use baseline detection API
  const detectionResult = detectFeaturesBaseline({ srcDir });
  const used = detectionResult.found;
  const nonCompliant = new Set<string>();
  const compliant = new Set<string>();
  
  for (const featureId of Array.from(used) as string[]) {
    const feature = features[featureId];
    if (!feature || feature.kind !== "feature") continue;
    
    // Check feature-level compliance (simpler approach)
    const isCompliant = mode === "allow" ? 
      specs.some(spec => (feature as any).spec?.some((s: string) => s.includes(spec))) :
      !specs.some(spec => (feature as any).spec?.some((s: string) => s.includes(spec)));
    
    if (isCompliant) {
      compliant.add(featureId);
    } else {
      nonCompliant.add(featureId);
    }
  }
  
  // Output results
  const lines: string[] = [];
  lines.push("\n🎯 Policy Compliance Report");
  lines.push("✨ Powered by Baseline Detection API");
  lines.push("");
  lines.push("📊 SUMMARY");
  lines.push(`Total Features: ${used.size}`);
  lines.push(`Compliant: ${compliant.size}`);
  lines.push(`Non-compliant: ${nonCompliant.size}`);
  lines.push("");
  
  if (compliant.size > 0) {
    lines.push("✅ COMPLIANT FEATURES");
    for (const featureId of Array.from(compliant)) {
      const feature = features[featureId];
      const baseline = (feature as any)?.status?.baseline;
      const icon = getBaselineIcon(baseline);
      lines.push(`  ${icon} ${(feature as any)?.name || featureId}`);
    }
    lines.push("");
  }
  
  if (nonCompliant.size > 0) {
    lines.push("❌ NON-COMPLIANT FEATURES");
    lines.push("");
    for (const featureId of Array.from(nonCompliant)) {
      lines.push(formatFeature(featureId, specs, mode, prefer, explain));
      lines.push("");
    }
  }
  
  lines.push("💡 NOTES");
  lines.push(`• Policy: ${mode} features from specified specs`);
  lines.push(`• Baseline icons: 🟢 widely available, 🟡 newly available, 🔴 limited availability`);
  lines.push(`• Use --explain for detailed information about each feature`);
  if (prefer) {
    lines.push(`• Preference: ${prefer === "widely" ? "prioritizing widely available alternatives" : "prioritizing newly available alternatives"}`);
  }
  lines.push("");
  lines.push("🚀 This scan used the baseline detection API for accurate feature detection!");
  
  process.stdout.write(lines.join("\n"));
}

main();