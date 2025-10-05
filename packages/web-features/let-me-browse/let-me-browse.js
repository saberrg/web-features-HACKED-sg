#!/usr/bin/env node
/**
 * let-me-browse - Baseline Coverage Audit Tool
 * 
 * Scans your source code to estimate minimum required browser versions 
 * based on detected web features using the unified detection system.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

// Import the data directly since index.js has CommonJS exports
const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
const { browsers, features } = data;
import { detectFeatures, formatDetectionResults } from "../detection-api.js";

function printHelp() {
  const help = `\nUsage: let-me-browse <srcDir>\n\nScans your source code to estimate minimum required browser versions based on detected web features.\n\nExamples:\n  let-me-browse ./src\n`;
  process.stdout.write(help);
}

function computeRequirements(featureIds) {
  const perBrowser = {};
  
  for (const featureId of Array.from(featureIds)) {
    const feature = features[featureId];
    if (!feature || feature.kind !== "feature") continue;
    
    const support = feature.status?.support;
    if (!support) continue;
    
    for (const [browserId, version] of Object.entries(support)) {
      if (!perBrowser[browserId]) {
        perBrowser[browserId] = { minVersion: version, baseline: "unknown" };
      } else {
        // Keep the highest version requirement
        const currentVersion = perBrowser[browserId].minVersion;
        if (version > currentVersion) {
          perBrowser[browserId].minVersion = version;
        }
      }
      
      // Set baseline status
      const baseline = feature.status?.baseline;
      if (baseline === "high") {
        perBrowser[browserId].baseline = "high";
      } else if (baseline === "low" && perBrowser[browserId].baseline !== "high") {
        perBrowser[browserId].baseline = "low";
      } else if (baseline === false && perBrowser[browserId].baseline === "unknown") {
        perBrowser[browserId].baseline = "false";
      }
    }
  }
  
  return perBrowser;
}

function getBaselineIcon(baseline) {
  switch (baseline) {
    case "high": return "🟢";
    case "low": return "🟡";
    case "false": return "🔴";
    default: return "❓";
  }
}

function formatOutput(perBrowser, detectedCount, detectionResult) {
  const lines = [];
  
  lines.push("\n🎯 Baseline Coverage Audit");
  lines.push("✨ Powered by Unified Detection API");
  lines.push("");
  lines.push("📊 SUMMARY");
  lines.push(`Detected Features: ${detectedCount}`);
  
  const highBaselineCount = Object.values(perBrowser).filter(b => b.baseline === "high").length;
  lines.push(`Baseline Compliance: ${highBaselineCount}/4 browsers have high baseline coverage`);
  lines.push("");
  
  lines.push("🌐 BROWSER REQUIREMENTS");
  lines.push("Browser  |  Min Version  |  Baseline Status");
  lines.push("-------------------------------------------");
  
  for (const [browserId, info] of Object.entries(perBrowser)) {
    const browserName = browserId.charAt(0).toUpperCase() + browserId.slice(1);
    const icon = getBaselineIcon(info.baseline);
    lines.push(`${browserName.padEnd(8)} |  ${info.minVersion.padEnd(10)} |  ${icon} ${info.baseline}`);
  }
  
  lines.push("");
  lines.push("🔍 DETECTED FEATURES");
  
  // Show detected features with baseline status
  for (const featureId of Array.from(detectionResult.found)) {
    const feature = features[featureId];
    if (feature) {
      const baseline = feature.status?.baseline;
      const icon = getBaselineIcon(baseline);
      const detail = detectionResult.details.get(featureId);
      lines.push(`  ${icon} ${feature.name} (${featureId})`);
      lines.push(`     ${feature.description}`);
      if (detail && detail.files.length > 0) {
        lines.push(`     Found in: ${detail.files.length} files`);
      }
      lines.push("");
    }
  }
  
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

  // Use unified detection API
  console.log("🔍 Scanning with unified detection API...");
  const detectionResult = detectFeatures({ srcDir });
  
  if (detectionResult.found.size === 0) {
    process.stdout.write("\nNo known features detected. Try adding more detectors or point to a different directory.\n\n");
    process.exit(0);
  }

  const perBrowser = computeRequirements(detectionResult.found);
  const output = formatOutput(perBrowser, detectionResult.found.size, detectionResult);
  
  process.stdout.write(output);
  process.stdout.write("\n\n");
}

main();
