#!/usr/bin/env node
/**
 * Baseline Feature Detector
 *
 * Uses the actual detection_patterns from baseline feature YAML files
 * instead of hardcoded patterns.
 */
type FileType = 'js' | 'ts' | 'jsx' | 'tsx' | 'css' | 'scss' | 'less' | 'other';
interface DetectionOptions {
    srcDir: string;
    fileTypes?: FileType[];
    features?: string[];
}
interface DetectionDetail {
    files: string[];
    matches: string[];
}
interface DetectionResult {
    found: Set<string>;
    details: Map<string, DetectionDetail>;
    summary: {
        totalFiles: number;
        totalFeatures: number;
        detectedFeatures: number;
    };
}
export declare function detectFeatures(options?: DetectionOptions): DetectionResult;
export declare function formatDetectionResults(result: DetectionResult): string;
export { detectFeatures as default };
