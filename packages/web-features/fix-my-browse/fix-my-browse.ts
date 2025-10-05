#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

import { browsers, features } from "../index.js";
// Import unified detection API
import { detectFeatures as detectFeaturesUnified } from "../detection-api.js";

type BrowserId = string;

interface Target {
  browser: BrowserId;
  version: string;
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

function checkTargets(usedFeatures: Set<string>, targets: Target[]) {
  const problems: Array<{
    browser: BrowserId;
    version: string;
    blockers: Array<{
      featureId: string;
      required: string;
      feature: string;
      baseline?: string;
    }>;
  }> = [];
  
  for (const target of targets) {
    const blockers: Array<{
      featureId: string;
      required: string;
      feature: string;
      baseline?: string;
    }> = [];
    
    for (const featureId of Array.from(usedFeatures)) {
      const feature = features[featureId];
      if (!feature || feature.kind !== "feature") continue;
      
      const required = (feature as any).status?.support?.[target.browser];
      if (!required) continue;
      
      if (compareVersions(target.version, required) < 0) {
        blockers.push({
          featureId,
          required,
          feature: (feature as any).name || featureId,
          baseline: (feature as any).status?.baseline
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

function getBaselineIcon(baseline?: string): string {
  switch (baseline) {
    case "high": return "🟢";
    case "low": return "🟡";
    case "false": return "🔴";
    default: return "❓";
  }
}

function formatOutput(problems: ReturnType<typeof checkTargets>): string {
  if (problems.length === 0) {
    return "\n✅ All targets satisfied by detected features.\n\n";
  }
  
  const lines: string[] = [];
  lines.push("\n🚫 Browser Target Compatibility Issues");
  lines.push("✨ Powered by Unified Detection API");
  lines.push("");
  
  for (const problem of problems) {
    const browserName = problem.browser.charAt(0).toUpperCase() + problem.browser.slice(1);
    lines.push(`❌ ${browserName} ${problem.version} has ${problem.blockers.length} blockers:`);
    lines.push("");
    
    for (const blocker of problem.blockers) {
      const feature = features[blocker.featureId];
      const baseline = blocker.baseline;
      const icon = getBaselineIcon(baseline);
      
      lines.push(`  ${icon} ${blocker.feature} (${blocker.featureId})`);
      lines.push(`     Requires: ${blocker.required}`);
      if ((feature as any)?.description) {
        lines.push(`     ${(feature as any).description}`);
      }
      lines.push("");
    }
  }
  
  lines.push("💡 Consider upgrading your browser targets or using alternative features.");
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

  const targetsArg = args.find((a) => a.startsWith("--targets="));
  const useDefault = args.includes("--default");
  const targetsString = targetsArg ? targetsArg.substring(10) : ""; // Remove "--targets="
  const targets = useDefault ? defaultTargets() : parseTargets(targetsString);
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