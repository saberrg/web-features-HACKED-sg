#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
// Import curated data (works in TS via tsx and in built JS)
import { browsers, features } from "./index";
// Minimal MVP detectors: fast, high-signal features
const DETECTORS = [
    {
        id: "has",
        label: "CSS :has() selector",
        fileTypes: ["css", "js", "ts", "jsx", "tsx"],
        patterns: [/\:has\(/],
    },
    {
        id: "grid",
        label: "CSS Grid",
        fileTypes: ["css"],
        patterns: [/display\s*:\s*grid\b/, /\bgrid-template\b/, /\bgrid-area\b/],
    },
    {
        id: "aborting",
        label: "AbortController/AbortSignal",
        fileTypes: ["js", "ts", "jsx", "tsx"],
        patterns: [/\bAbortController\b/, /\bAbortSignal\b/],
    },
    {
        id: "async-clipboard",
        label: "Async Clipboard API",
        fileTypes: ["js", "ts", "jsx", "tsx"],
        patterns: [/\bnavigator\.clipboard\b/, /\bClipboardItem\b/],
    },
    // Add more high-impact detectors here as needed
];
function printHelp() {
    const help = `\nUsage: let-me-browse <srcDir>\n\nScans your source code to estimate minimum required browser versions based on detected web features.\n\nExamples:\n  let-me-browse ./src\n`;
    process.stdout.write(help);
}
function* walk(dir) {
    const stack = [dir];
    while (stack.length) {
        const current = stack.pop();
        let entries = [];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        }
        catch (_a) {
            continue;
        }
        for (const e of entries) {
            if (e.name === "node_modules" || e.name.startsWith(".")) {
                continue;
            }
            const full = path.join(current, e.name);
            if (e.isDirectory()) {
                stack.push(full);
            }
            else if (e.isFile()) {
                yield full;
            }
        }
    }
}
function extOf(file) {
    const ext = path.extname(file).toLowerCase();
    if (ext === ".js")
        return "js";
    if (ext === ".ts")
        return "ts";
    if (ext === ".jsx")
        return "jsx";
    if (ext === ".tsx")
        return "tsx";
    if (ext === ".css")
        return "css";
    return "other";
}
function detectFeatures(srcDir) {
    const found = new Set();
    for (const file of walk(srcDir)) {
        const ft = extOf(file);
        if (ft === "other")
            continue;
        let text;
        try {
            text = fs.readFileSync(file, "utf8");
        }
        catch (_a) {
            continue;
        }
        for (const d of DETECTORS) {
            if (!d.fileTypes.includes(ft))
                continue;
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
function compareVersions(a, b) {
    var _a, _b;
    // Compare version strings like "16.4" vs "15.6" numerically
    const sanitize = (v) => v.replace(/[^0-9.]/g, "");
    const as = sanitize(a).split(".").map((n) => parseInt(n, 10));
    const bs = sanitize(b).split(".").map((n) => parseInt(n, 10));
    const len = Math.max(as.length, bs.length);
    for (let i = 0; i < len; i++) {
        const ai = (_a = as[i]) !== null && _a !== void 0 ? _a : 0;
        const bi = (_b = bs[i]) !== null && _b !== void 0 ? _b : 0;
        if (ai > bi)
            return 1;
        if (ai < bi)
            return -1;
    }
    return 0;
}
function maxVersion(versions) {
    if (versions.length === 0)
        return undefined;
    return versions.reduce((max, v) => (compareVersions(v, max) > 0 ? v : max));
}
function computeRequirements(usedFeatureIds) {
    var _a, _b;
    const browserIds = Object.keys(browsers);
    const perBrowser = {};
    for (const b of browserIds) {
        const needed = [];
        const missing = [];
        const versionByFeature = [];
        for (const fid of usedFeatureIds) {
            const f = features[fid];
            if (!f || f.kind !== "feature")
                continue;
            const v = (_b = (_a = f.status) === null || _a === void 0 ? void 0 : _a.support) === null || _b === void 0 ? void 0 : _b[b];
            if (typeof v === "string" && v.length > 0) {
                needed.push(v);
                versionByFeature.push({ featureId: fid, version: v });
            }
            else {
                missing.push(fid);
            }
        }
        const min = maxVersion(needed);
        const blockers = min
            ? versionByFeature.filter((x) => compareVersions(x.version, min) === 0)
            : [];
        perBrowser[b] = { minVersion: min, missing, blockers };
    }
    return perBrowser;
}
function formatOutput(perBrowser) {
    var _a, _b, _c;
    const lines = [];
    lines.push("");
    lines.push("Baseline Coverage Audit\n");
    const header = ["Browser", "Min Version"].join("  |  ");
    lines.push(header);
    lines.push("-".repeat(header.length));
    for (const [bid, info] of Object.entries(perBrowser)) {
        const name = (_b = (_a = browsers[bid]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : bid;
        lines.push([name, (_c = info.minVersion) !== null && _c !== void 0 ? _c : "n/a"].join("  |  "));
    }
    lines.push("");
    lines.push("Min Version = earliest browser version that supports all detected features found.");
    lines.push("Detection is heuristic (MVP). Add more detectors to improve coverage.");
    lines.push("");
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
    const used = detectFeatures(srcDir);
    if (used.size === 0) {
        process.stdout.write("\nNo known features detected. Try adding more detectors or point to a different directory.\n\n");
        process.exit(0);
    }
    const perBrowser = computeRequirements(used);
    const output = formatOutput(perBrowser);
    process.stdout.write(output);
}
main();
