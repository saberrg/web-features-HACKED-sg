#!/usr/bin/env node
"use strict";
/**
 * Baseline Feature Detector
 *
 * Uses the actual detection_patterns from baseline feature YAML files
 * instead of hardcoded patterns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectFeatures = detectFeatures;
exports.default = detectFeatures;
exports.formatDetectionResults = formatDetectionResults;
const fs = require("node:fs");
const path = require("node:path");
const node_fs_1 = require("node:fs");
// Simple YAML parser for basic key-value extraction
function parseYamlSimple(content) {
    const result = {};
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed)
            continue;
        if (trimmed.includes(':')) {
            const [key, ...valueParts] = trimmed.split(':');
            const keyTrimmed = key.trim();
            const valueTrimmed = valueParts.join(':').trim();
            if (keyTrimmed === 'detection_patterns') {
                result.detection_patterns = {};
            }
            else if (keyTrimmed === 'file_types') {
                result.file_types = [];
            }
            else if (keyTrimmed === 'name') {
                result.name = valueTrimmed;
            }
            else if (keyTrimmed === 'description') {
                result.description = valueTrimmed;
            }
            else if (keyTrimmed === 'status') {
                result.status = {};
            }
            else if (result.detection_patterns && keyTrimmed.match(/^(css|js|ts|jsx|tsx)$/)) {
                // Parse detection pattern arrays for specific file types
                if (valueTrimmed.startsWith('[') && valueTrimmed.endsWith(']')) {
                    const patterns = valueTrimmed.slice(1, -1).split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
                    result.detection_patterns[keyTrimmed] = patterns;
                }
            }
            else if (result.file_types && valueTrimmed.startsWith('[') && valueTrimmed.endsWith(']')) {
                const types = valueTrimmed.slice(1, -1).split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
                result.file_types = types;
            }
            else if (result.status && keyTrimmed.startsWith('  ') && keyTrimmed.includes(':')) {
                const statusKey = keyTrimmed.trim();
                result.status[statusKey] = valueTrimmed;
            }
        }
    }
    return result;
}
const index_js_1 = require("./index.js");
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
// Build detection patterns from YAML source files directly
function buildDetectionPatterns() {
    const patterns = {};
    // Read YAML files directly from features directory
    const featuresDir = path.resolve(process.cwd(), '../../features');
    try {
        const featureFiles = fs.readdirSync(featuresDir).filter(file => file.endsWith('.yml'));
        for (const file of featureFiles) {
            const featureId = path.basename(file, '.yml');
            const filePath = path.join(featuresDir, file);
            try {
                const yamlContent = (0, node_fs_1.readFileSync)(filePath, 'utf8');
                const yamlData = parseYamlSimple(yamlContent);
                if (!yamlData.detection_patterns)
                    continue;
                const compiledPatterns = {};
                // Convert string patterns to regex for each file type
                for (const [fileType, patternStrings] of Object.entries(yamlData.detection_patterns)) {
                    if (Array.isArray(patternStrings)) {
                        const validFileType = ['js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'less'].includes(fileType);
                        if (validFileType) {
                            compiledPatterns[fileType] = patternStrings.map((pattern) => new RegExp(pattern, 'g'));
                        }
                    }
                }
                if (Object.keys(compiledPatterns).length > 0) {
                    patterns[featureId] = {
                        name: yamlData.name || featureId,
                        description: yamlData.description || "No description",
                        patterns: compiledPatterns,
                        fileTypes: yamlData.file_types || [],
                        baseline: String(yamlData.status?.baseline || 'unknown')
                    };
                }
            }
            catch (error) {
                // Skip files we can't parse
                continue;
            }
        }
    }
    catch (error) {
        // Fallback to built features data if YAML reading fails
        console.warn('Could not read YAML files, falling back to built features data');
        for (const [featureId, feature] of Object.entries(index_js_1.features)) {
            if (!feature || feature.kind !== "feature")
                continue;
            const detectionPatterns = feature.detection_patterns;
            if (!detectionPatterns)
                continue;
            const compiledPatterns = {};
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
    }
    return patterns;
}
// Main detection function
function detectFeatures(options = { srcDir: '' }) {
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
function formatDetectionResults(result) {
    const lines = [];
    lines.push(`🎯 Baseline Feature Detection`);
    lines.push(`Files scanned: ${result.summary.totalFiles}`);
    lines.push(`Features detected: ${result.summary.detectedFeatures}/${result.summary.totalFeatures}`);
    lines.push('');
    if (result.found.size > 0) {
        lines.push('🔍 Detected Features:');
        for (const featureId of Array.from(result.found)) {
            const feature = index_js_1.features[featureId];
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
