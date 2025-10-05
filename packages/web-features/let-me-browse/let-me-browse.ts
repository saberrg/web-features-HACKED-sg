#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

// Import curated data and baseline computation tools
import { browsers, features } from "../index.js";
// Import unified detection API
import { detectFeatures as detectFeaturesUnified } from "../detection-api.js";
// Note: compute-baseline import will be available after build
// import { computeBaseline } from "compute-baseline";

type BrowserId = string;

function printHelp(): void {
  const help = `\nUsage: let-me-browse <srcDir>\n\nScans your source code to estimate minimum required browser versions based on detected web features.\n\nExamples:\n  let-me-browse ./src\n`;
  process.stdout.write(help);
}

function computeRequirements(featureIds: string[]) {
  const browserIds = Object.keys(browsers) as BrowserId[];
  const perBrowser: Record<string, {
    minVersion: string;
    baseline: string;
    blockers: Array<{ featureId: string; version: string; baseline: string }>;
  }> = {};
  
  for (const browserId of browserIds) {
    perBrowser[browserId] = {
      minVersion: "0",
      baseline: "unknown",
      blockers: []
    };
  }
  
  for (const featureId of featureIds) {
    const feature = features[featureId];
    if (!feature || feature.kind !== "feature") continue;
    
    const support = feature.status?.support;
    if (!support) continue;
    
    for (const [browserId, version] of Object.entries(support)) {
      if (!perBrowser[browserId]) continue;
      
      const currentVersion = perBrowser[browserId].minVersion;
      if (version > currentVersion) {
        perBrowser[browserId].minVersion = version;
      }
      
      // Set baseline status
      const baseline = (feature as any).status?.baseline;
      if (baseline === "high") {
        perBrowser[browserId].baseline = "high";
      } else if (baseline === "low" && perBrowser[browserId].baseline !== "high") {
        perBrowser[browserId].baseline = "low";
      } else if (baseline === false && perBrowser[browserId].baseline === "unknown") {
        perBrowser[browserId].baseline = "false";
      }
      
      // Add to blockers for reporting
      perBrowser[browserId].blockers.push({
        featureId,
        version,
        baseline: (baseline as string) || "unknown"
      });
    }
  }
  
  return perBrowser;
}

function getBaselineIcon(baseline: string): string {
  switch (baseline) {
    case "high": return "🟢";
    case "low": return "🟡";
    case "false": return "🔴";
    default: return "❓";
  }
}

function formatOutput(perBrowser: ReturnType<typeof computeRequirements>, detectedCount: number, detectionResult: any): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("🎯 Baseline Coverage Audit");
  lines.push("✨ Powered by Unified Detection API");
  lines.push("");
  
  // Summary section
  lines.push("📊 SUMMARY");
  lines.push(`Detected Features: ${detectedCount}`);
  
  const highBaselineCount = Object.values(perBrowser).filter(b => b.baseline === "high").length;
  lines.push(`Baseline Compliance: ${highBaselineCount}/${Object.keys(perBrowser).length} browsers have high baseline coverage`);
  lines.push("");
  
  // Browser requirements
  lines.push("🌐 BROWSER REQUIREMENTS");
  lines.push("Browser  |  Min Version  |  Baseline Status");
  lines.push("-------------------------------------------");
  
  for (const [browserId, info] of Object.entries(perBrowser)) {
    const browserName = browserId.charAt(0).toUpperCase() + browserId.slice(1);
    const icon = getBaselineIcon(info.baseline);
    lines.push(`${browserName.padEnd(8)} |  ${info.minVersion.padEnd(10)} |  ${icon} ${info.baseline}`);
  }
  
  lines.push("");
  
  // Detected features
  lines.push("🔍 DETECTED FEATURES");
  
  for (const featureId of Array.from(detectionResult.found) as string[]) {
    const feature = features[featureId];
    if (feature) {
      const baseline = (feature as any).status?.baseline;
      const icon = getBaselineIcon(baseline);
      const detail = detectionResult.details.get(featureId);
      lines.push(`  ${icon} ${(feature as any).name} (${featureId})`);
      lines.push(`     ${(feature as any).description}`);
      if (detail && detail.files.length > 0) {
        lines.push(`     Found in: ${detail.files.length} files`);
      }
      lines.push("");
    }
  }
  
  lines.push("🚀 This scan used the unified detection API for accurate feature detection!");
  
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

  // Use unified detection API
  const detectionResult = detectFeaturesUnified({ srcDir });
  if (detectionResult.found.size === 0) {
    process.stdout.write("\nNo known features detected. Try adding more detectors or point to a different directory.\n\n");
    process.exit(0);
  }

  const used = Array.from(detectionResult.found) as string[];
  const perBrowser = computeRequirements(used);
  const output = formatOutput(perBrowser, detectionResult.found.size, detectionResult);
  
  process.stdout.write(output);
  process.stdout.write("\n\n");
}

main();