#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");
// Import curated data and baseline computation tools
const index_js_1 = require("../index.js");
// Import baseline detection API
const baseline_detector_js_1 = require("../baseline-detector.js");
const core_browser_set_js_1 = require("../../compute-baseline/src/baseline/core-browser-set.js");
function printHelp() {
    const help = `\nUsage: let-me-browse <srcDir>\n\nScans your source code to estimate minimum required browser versions based on detected web features.\n\nExamples:\n  let-me-browse ./src\n`;
    process.stdout.write(help);
}
function computeRequirements(featureIds) {
    const perBrowser = {};
    // Initialize with core browsers
    for (const browserId of core_browser_set_js_1.identifiers) {
        perBrowser[browserId] = {
            minVersion: "0",
            baseline: "unknown",
            blockers: []
        };
    }
    for (const featureId of featureIds) {
        const feature = index_js_1.features[featureId];
        if (!feature || feature.kind !== "feature")
            continue;
        // Use feature-level support for now (simpler approach)
        const support = feature.status?.support;
        if (support) {
            for (const [browserId, version] of Object.entries(support)) {
                if (!perBrowser[browserId])
                    continue;
                const currentVersion = perBrowser[browserId].minVersion;
                if (String(version) > currentVersion) {
                    perBrowser[browserId].minVersion = String(version);
                }
                // Set baseline status
                const baseline = feature.status?.baseline;
                if (baseline === "high") {
                    perBrowser[browserId].baseline = "high";
                }
                else if (baseline === "low" && perBrowser[browserId].baseline !== "high") {
                    perBrowser[browserId].baseline = "low";
                }
                else if (baseline === false && perBrowser[browserId].baseline === "unknown") {
                    perBrowser[browserId].baseline = "false";
                }
                // Add to blockers for reporting
                perBrowser[browserId].blockers.push({
                    featureId,
                    bcdKey: "feature-level",
                    version: String(version),
                    baseline: String(baseline) || "unknown"
                });
            }
        }
    }
    return perBrowser;
}
function getBaselineIcon(baseline) {
    switch (baseline) {
        case "high": return "[HIGH]";
        case "low": return "[LOW]";
        case "false": return "[LIMITED]";
        default: return "[UNKNOWN]";
    }
}
function formatOutput(perBrowser, detectedCount, detectionResult) {
    const lines = [];
    lines.push("");
    lines.push("Baseline Coverage Audit");
    lines.push("");
    // Summary section
    lines.push("SUMMARY");
    lines.push(`Detected Features: ${detectedCount}`);
    const browsersWithVersions = Object.values(perBrowser).filter(b => b.minVersion > 0);
    const highBaselineCount = browsersWithVersions.filter(b => b.baseline === "high").length;
    lines.push(`Baseline Compliance: ${highBaselineCount}/${browsersWithVersions.length} browsers have high baseline coverage`);
    lines.push("");
    // Browser requirements
    lines.push("BROWSER REQUIREMENTS");
    lines.push("Browser  |  Min Version  |  Baseline Status");
    lines.push("-------------------------------------------");
    for (const [browserId, info] of Object.entries(perBrowser)) {
        const browserName = browserId.charAt(0).toUpperCase() + browserId.slice(1);
        const icon = getBaselineIcon(info.baseline);
        lines.push(`${browserName.padEnd(8)} |  ${info.minVersion.padEnd(10)} |  ${icon} ${info.baseline}`);
    }
    lines.push("");
    // Detected features
    lines.push("DETECTED FEATURES");
    for (const featureId of Array.from(detectionResult.found)) {
        const feature = index_js_1.features[featureId];
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
    // Use baseline detection API
    const detectionResult = (0, baseline_detector_js_1.detectFeatures)({ srcDir });
    if (detectionResult.found.size === 0) {
        process.stdout.write("\nNo known features detected. Try adding more detectors or point to a different directory.\n\n");
        process.exit(0);
    }
    const used = Array.from(detectionResult.found);
    const perBrowser = computeRequirements(used);
    const output = formatOutput(perBrowser, detectionResult.found.size, detectionResult);
    process.stdout.write(output);
    process.stdout.write("\n\n");
}
main();
