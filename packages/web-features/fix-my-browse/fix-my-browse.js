#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import { browsers, features } from "../index.js";
import { detectFeatures as detectFeaturesBaseline } from "../baseline-detector.js";
import { identifiers as coreBrowserSet } from "../../compute-baseline/src/baseline/core-browser-set.js";
//CLI tool that answers the question of will my code break on these browsers?
// scans your code for web features and checks if they are supported by the browser targets.
//use this by doing fix-my-browse <srcDir> --targets=<list>|--default
//for example: fix-my-browse ./src --targets=chrome>=116,firefox>=117,safari>=16.4,edge>=116
//if everything is good, you will see a message like this: All targets satisfied by detected features.
function printHelp() {
    const help = `\nUsage: fix-my-browse <srcDir> --targets=<list>|--default\n\nExamples:\n  fmb ./src --targets=chrome>=116,firefox>=117,safari>=16.4,edge>=116\n  fmb ./packages/app --default\n\n--default uses a reasonable set of current stable majors (from browsers data).\n`;
    process.stdout.write(help);
}
//organizes the targets into a list of browser and version
function parseTargets(arg) {
    if (!arg)
        return [];
    const items = arg.split(",").map((x) => x.trim()).filter(Boolean);
    const out = [];
    for (const item of items) {
        const m = item.match(/^(chrome|chrome_android|edge|firefox|firefox_android|safari|safari_ios)\s*>=\s*([0-9]+(?:\.[0-9]+)*)$/i);
        if (!m)
            continue;
        out.push({ browser: m[1].toLowerCase(), version: m[2] });
    }
    return out;
}
function defaultTargets() {
    const out = [];
    for (const browserId of coreBrowserSet) {
        const browser = browsers[browserId];
        if (browser?.releases) {
            const latest = browser.releases[browser.releases.length - 1]?.version;
            if (latest)
                out.push({ browser: browserId, version: latest });
        }
    }
    return out;
}
//... compares browser versions!
function compareVersions(a, b) {
    const sanitize = (v) => v.replace(/[^0-9.]/g, "");
    const as = sanitize(a).split(".").map((n) => parseInt(n, 10));
    const bs = sanitize(b).split(".").map((n) => parseInt(n, 10));
    const len = Math.max(as.length, bs.length);
    for (let i = 0; i < len; i++) {
        const ai = as[i] ?? 0;
        const bi = bs[i] ?? 0;
        if (ai > bi)
            return 1;
        if (ai < bi)
            return -1;
    }
    return 0;
}
//checks if the features are supported by the targeted browsers using granular BCD key checking
function checkTargets(usedFeatures, targets) {
    const problems = [];
    for (const target of targets) {
        const blockers = [];
        for (const featureId of Array.from(usedFeatures)) {
            const feature = features[featureId];
            if (!feature || feature.kind !== "feature")
                continue;
            // Use feature-level support for now (simpler approach)
            const required = feature.status?.support?.[target.browser];
            if (required && compareVersions(target.version, required) < 0) {
                blockers.push({
                    featureId,
                    bcdKey: "feature-level",
                    required,
                    feature: feature.name || featureId,
                    baseline: String(feature.status?.baseline || 'unknown')
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
        case "high": return "[HIGH]";
        case "low": return "[LOW]";
        case "false": return "[LIMITED]";
        default: return "[UNKNOWN]";
    }
}
function formatOutput(problems) {
    if (problems.length === 0) {
        return "\n All targets satisfied by detected features!!! :) \n\n";
    }
    const lines = [];
    lines.push("\nBrowser Target Compatibility Issues...");
    lines.push("");
    for (const problem of problems) {
        const browserName = problem.browser.charAt(0).toUpperCase() + problem.browser.slice(1);
        lines.push(`${browserName} ${problem.version} has ${problem.blockers.length} blockers:`);
        lines.push("");
        for (const blocker of problem.blockers) {
            const feature = features[blocker.featureId];
            const baseline = blocker.baseline;
            const icon = getBaselineIcon(baseline);
            lines.push(`  ${icon} ${blocker.feature} (${blocker.featureId})`);
            lines.push(`     BCD Key: ${blocker.bcdKey}`);
            lines.push(`     Requires: ${blocker.required}`);
            if (feature?.description) {
                lines.push(`     ${feature.description}`);
            }
            lines.push("");
        }
    }
    lines.push("Consider upgrading your browser targets or using alternative features.");
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
    const targetsArg = args.find((a) => a.startsWith("--targets="));
    const useDefault = args.includes("--default");
    const targetsString = targetsArg ? targetsArg.substring(10) : ""; // Remove "--targets="
    const targets = useDefault ? defaultTargets() : parseTargets(targetsString);
    if (!targets.length) {
        process.stderr.write("Error: provide --targets=list or --default.\n");
        process.exit(2);
    }
    const detectionResult = detectFeaturesBaseline({ srcDir });
    const used = detectionResult.found;
    const problems = checkTargets(used, targets);
    process.stdout.write(formatOutput(problems));
}
main();
