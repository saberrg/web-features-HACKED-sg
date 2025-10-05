#!/usr/bin/env node
/**
 * fix-my-browse - Browser Target Compatibility Checker
 * 
 * Checks if your chosen browser targets are compatible with detected features
 * using the unified detection system.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

// Import the data directly
const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
const { browsers, features } = data;
import { detectFeatures } from "../detection-api.js";

function printHelp() {
  const help = `\nUsage: fix-my-browse <srcDir> --targets=<list> [--default]\n\nChecks if your chosen browser targets are compatible with detected features.\n\nExamples:\n  fix-my-browse ./src --targets=chrome>=100,firefox>=100\n  fix-my-browse ./src --default\n`;
  process.stdout.write(help);
}

function parseTargets(targetsString) {
  if (!targetsString) return [];
  return targetsString.split(",").map(t => {
    const parts = t.split(">=");
    if (parts.length !== 2) return null;
    return { browser: parts[0].trim(), version: parts[1].trim() };
  }).filter(Boolean);
}

function defaultTargets() {
  return [
    { browser: "chrome", version: "100" },
    { browser: "firefox", version: "100" },
    { browser: "safari", version: "15" },
    { browser: "edge", version: "100" }
  ];
}

function compareVersions(a, b) {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    if (aPart < bPart) return -1;
    if (aPart > bPart) return 1;
  }
  return 0;
}

function checkTargets(usedFeatures, targets) {
  const problems = [];
  
  for (const target of targets) {
    const blockers = [];
    
    for (const featureId of Array.from(usedFeatures)) {
      const feature = features[featureId];
      if (!feature || feature.kind !== "feature") continue;
      
      const required = feature.status?.support?.[target.browser];
      if (!required) continue;
      
      if (compareVersions(target.version, required) < 0) {
        blockers.push({
          featureId,
          required,
          feature: feature.name || featureId
        });
      }
    }
    
    if (blockers.length > 0) {
      problems.push({
        browser: target.browser,
        version: target.version,
        blockers
      });
    }
  }
  
  return problems;
}

function getBaselineIcon(baseline) {
  switch (baseline) {
    case "high": return "🟢";
    case "low": return "🟡";
    case "false": return "🔴";
    default: return "❓";
  }
}

function formatOutput(problems) {
  if (problems.length === 0) {
    return "\n✅ All targets satisfied by detected features.\n\n";
  }
  
  const lines = [];
  lines.push("\n🚫 Browser Target Compatibility Issues");
  lines.push("✨ Powered by Unified Detection API");
  lines.push("");
  
  for (const problem of problems) {
    const browserName = problem.browser.charAt(0).toUpperCase() + problem.browser.slice(1);
    lines.push(`❌ ${browserName} ${problem.version} has ${problem.blockers.length} blockers:`);
    lines.push("");
    
    for (const blocker of problem.blockers) {
      const feature = features[blocker.featureId];
      const baseline = feature?.status?.baseline;
      const icon = getBaselineIcon(baseline);
      
      lines.push(`  ${icon} ${blocker.feature} (${blocker.featureId})`);
      lines.push(`     Requires: ${blocker.required}`);
      if (feature?.description) {
        lines.push(`     ${feature.description}`);
      }
      lines.push("");
    }
  }
  
  lines.push("💡 Consider upgrading your browser targets or using alternative features.");
  lines.push("🚀 This scan used the unified detection API for accurate feature detection!");
  
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

  const targetsArg = args.find(a => a.startsWith("--targets="));
  const useDefault = args.includes("--default");
  const targetsString = targetsArg ? targetsArg.substring(10) : ""; // Remove "--targets="
  const targets = useDefault ? defaultTargets() : parseTargets(targetsString);
  
  if (!targets.length) {
    process.stderr.write("Error: provide --targets=list or --default.\n");
    process.exit(2);
  }

  // Use unified detection API
  console.log("🔍 Scanning with unified detection API...");
  const detectionResult = detectFeatures({ srcDir });
  const used = detectionResult.found;
  const problems = checkTargets(used, targets);
  
  process.stdout.write(formatOutput(problems));
}

main();
