#!/usr/bin/env node
/**
 * set-my-browse - Web Standards Policy Enforcer
 * 
 * Enforces specific web standards or avoids certain features,
 * suggesting alternatives using the unified detection system.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

// Import the data directly
const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
const { features, groups, snapshots } = data;
import { detectFeatures } from "../detection-api.js";

function printHelp() {
  const help = `\nUsage: set-my-browse <srcDir> --specs=<list> --mode=<allow|deny> [--prefer=<widely|newly>] [--explain]\n\nEnforces specific web standards or avoids certain features.\n\nExamples:\n  set-my-browse ./src --specs=csswg --mode=allow\n  set-my-browse ./src --specs=whatwg --mode=deny --prefer=widely\n`;
  process.stdout.write(help);
}

function parseSpecs(specsString) {
  if (!specsString) return [];
  return specsString.split(",").map(s => s.trim());
}

function getBaselineIcon(baseline) {
  switch (baseline) {
    case "high": return "🟢";
    case "low": return "🟡";
    case "false": return "🔴";
    default: return "❓";
  }
}

function formatFeature(featureId, specs, mode, prefer, explain) {
  const feature = features[featureId];
  if (!feature) return `❓ ${featureId}`;
  
  const baseline = feature.status?.baseline;
  const icon = getBaselineIcon(baseline);
  const name = feature.name || featureId;
  const description = feature.description || "No description available";
  
  let lines = [];
  lines.push(`${icon} ${name} (${featureId})`);
  
  if (explain) {
    lines.push(`   Description: ${description}`);
    lines.push(`   Baseline: ${baseline || "unknown"}`);
    if (feature.spec) {
      lines.push(`   Specs: ${feature.spec.join(", ")}`);
    }
  }
  
  // Add alternatives
  const alternatives = feature.discouraged?.alternatives || [];
  if (alternatives.length > 0) {
    lines.push(`   💡 Alternatives: ${alternatives.join(", ")}`);
  }
  
  return lines.join("\n");
}

function main() {
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
  
  const specsArg = args.find(a => a.startsWith("--specs="));
  const modeArg = args.find(a => a.startsWith("--mode="));
  const preferArg = args.find(a => a.startsWith("--prefer="));
  const explain = args.includes("--explain");
  
  const specs = parseSpecs(specsArg?.split("=")[1]);
  const mode = modeArg?.split("=")[1];
  
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
  console.log("🔍 Scanning with unified detection API...");
  const detectionResult = detectFeatures({ srcDir });
  const used = detectionResult.found;
  const nonCompliant = new Set();
  const compliant = new Set();
  
  for (const featureId of Array.from(used)) {
    const feature = features[featureId];
    if (!feature || feature.kind !== "feature") continue;
    
    const isCompliant = mode === "allow" ? 
      specs.some(spec => feature.spec?.some(s => s.includes(spec))) :
      !specs.some(spec => feature.spec?.some(s => s.includes(spec)));
    
    if (isCompliant) {
      compliant.add(featureId);
    } else {
      nonCompliant.add(featureId);
    }
  }
  
  // Output results
  const lines = [];
  lines.push("\n🎯 Policy Compliance Report");
  lines.push("✨ Powered by Unified Detection API");
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
      const baseline = feature?.status?.baseline;
      const icon = getBaselineIcon(baseline);
      lines.push(`  ${icon} ${feature?.name || featureId}`);
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
  lines.push("🚀 This scan used the unified detection API for accurate feature detection!");
  
  process.stdout.write(lines.join("\n"));
}

main();
