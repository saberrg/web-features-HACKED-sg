#!/usr/bin/env node
/**
 * Baseline Feature Detector
 *
 * Uses the actual detection_patterns from baseline feature YAML files
 * instead of hardcoded patterns.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { features } from "./index.js";
// File type mapping
function getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.js': return 'js';
        case '.ts': return 'ts';
        case '.jsx': return 'jsx';
        case '.tsx': return 'tsx';
        case '.css': return 'css';
        case '.scss': return 'scss';
        case '.less': return 'less';
        default: return 'other';
    }
}
// File walking utility
function* walkDirectory(dir) {
    const stack = [dir];
    while (stack.length > 0) {
        const currentDir = stack.pop();
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    // Skip node_modules, .git, etc.
                    if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        stack.push(fullPath);
                    }
                }
                else if (entry.isFile()) {
                    yield fullPath;
                }
            }
        }
        catch (error) {
            // Skip directories we can't read
            continue;
        }
    }
}
// Build detection patterns from actual feature data
function buildDetectionPatterns() {
    const patterns = {};
    for (const [featureId, feature] of Object.entries(features)) {
        if (!feature || feature.kind !== "feature")
            continue;
        const detectionPatterns = feature.detection_patterns;
        if (!detectionPatterns)
            continue;
        const compiledPatterns = {};
        // Convert string patterns to regex for each file type
        for (const [fileType, patternStrings] of Object.entries(detectionPatterns)) {
            if (Array.isArray(patternStrings)) {
                const validFileType = ['js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'less'].includes(fileType);
                if (validFileType) {
                    compiledPatterns[fileType] = patternStrings.map(pattern => new RegExp(pattern, 'g'));
                }
            }
        }
        if (Object.keys(compiledPatterns).length > 0) {
            patterns[featureId] = {
                name: feature.name || featureId,
                description: feature.description || "No description",
                patterns: compiledPatterns,
                fileTypes: feature.file_types || [],
                baseline: String(feature.status?.baseline || 'unknown')
            };
        }
    }
    return patterns;
}
// Main detection function
export function detectFeatures(options = { srcDir: '' }) {
    const { srcDir, fileTypes = [], features = [] } = options;
    const found = new Set();
    const details = new Map();
    let totalFiles = 0;
    // Build patterns from actual feature data
    const allPatterns = buildDetectionPatterns();
    // Filter patterns if specific features requested
    const activePatterns = features.length > 0
        ? Object.fromEntries(Object.entries(allPatterns).filter(([id]) => features.includes(id)))
        : allPatterns;
    // Walk through source directory
    for (const filePath of Array.from(walkDirectory(srcDir))) {
        const fileType = getFileType(filePath);
        // Skip files we don't care about
        if (fileType === 'other')
            continue;
        if (fileTypes.length > 0 && !fileTypes.includes(fileType))
            continue;
        totalFiles++;
        let fileContent;
        try {
            fileContent = fs.readFileSync(filePath, 'utf8');
        }
        catch (error) {
            continue; // Skip files we can't read
        }
        // Check each feature pattern
        for (const [featureId, feature] of Object.entries(activePatterns)) {
            const patterns = feature.patterns[fileType];
            if (!patterns)
                continue;
            let hasMatch = false;
            const matches = [];
            for (const pattern of patterns) {
                pattern.lastIndex = 0; // Reset regex state
                const match = pattern.exec(fileContent);
                if (match) {
                    hasMatch = true;
                    matches.push(match[0]);
                }
            }
            if (hasMatch) {
                found.add(featureId);
                if (!details.has(featureId)) {
                    details.set(featureId, { files: [], matches: [] });
                }
                const detail = details.get(featureId);
                detail.files.push(filePath);
                detail.matches.push(...matches);
            }
        }
    }
    return {
        found,
        details,
        summary: {
            totalFiles,
            totalFeatures: Object.keys(activePatterns).length,
            detectedFeatures: found.size
        }
    };
}
// Utility function for CLI tools
export function formatDetectionResults(result) {
    const lines = [];
    lines.push(`🎯 Baseline Feature Detection`);
    lines.push(`Files scanned: ${result.summary.totalFiles}`);
    lines.push(`Features detected: ${result.summary.detectedFeatures}/${result.summary.totalFeatures}`);
    lines.push('');
    if (result.found.size > 0) {
        lines.push('🔍 Detected Features:');
        for (const featureId of Array.from(result.found)) {
            const feature = features[featureId];
            if (feature) {
                const baseline = feature.status?.baseline;
                const baselineIcon = baseline === 'high' ? '🟢' : baseline === 'low' ? '🟡' : '🔴';
                const detail = result.details.get(featureId);
                lines.push(`  ${baselineIcon} ${feature.name} (${detail?.files.length || 0} files)`);
            }
        }
    }
    else {
        lines.push('❌ No features detected');
    }
    return lines.join('\n');
}
// Export the main detection function as default
export { detectFeatures as default };
