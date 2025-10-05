#!/usr/bin/env node
/**
 * Unified Detection API for Baseline Web Features
 * 
 * This module provides a standardized way to detect web features in source code
 * using patterns defined in the baseline feature data.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Import the features data (we'll need to create a simple version for now)
// For now, we'll use the hardcoded patterns but structure it to be easily replaceable
const DETECTION_PATTERNS = {
  'fetch': {
    name: 'Fetch',
    description: 'The fetch() method makes asynchronous HTTP requests.',
    patterns: {
      js: [/\bfetch\s*\(/, /\bResponse\b/, /\bRequest\b/, /\bHeaders\b/],
      ts: [/\bfetch\s*\(/, /\bResponse\b/, /\bRequest\b/, /\bHeaders\b/]
    },
    fileTypes: ['js', 'ts', 'jsx', 'tsx'],
    baseline: 'high'
  },
  'grid': {
    name: 'CSS Grid',
    description: 'CSS grid is a two-dimensional layout system.',
    patterns: {
      css: [/display\s*:\s*grid\b/, /\bgrid-template\b/, /\bgrid-area\b/, /\bgrid-column\b/, /\bgrid-row\b/]
    },
    fileTypes: ['css', 'scss', 'less'],
    baseline: 'high'
  },
  'has': {
    name: 'CSS :has()',
    description: 'The :has() CSS functional pseudo-class matches elements based on their contents.',
    patterns: {
      css: [/\:has\(/]
    },
    fileTypes: ['css', 'scss', 'less'],
    baseline: 'low'
  },
  'async-clipboard': {
    name: 'Async Clipboard',
    description: 'The navigator.clipboard API asynchronously reads and writes to the system clipboard.',
    patterns: {
      js: [/\bnavigator\.clipboard\b/, /\bClipboardItem\b/, /\.writeText\b/, /\.readText\b/],
      ts: [/\bnavigator\.clipboard\b/, /\bClipboardItem\b/, /\.writeText\b/, /\.readText\b/]
    },
    fileTypes: ['js', 'ts', 'jsx', 'tsx'],
    baseline: 'low'
  },
  'aborting': {
    name: 'AbortController and AbortSignal',
    description: 'The AbortController and AbortSignal APIs allow you to cancel ongoing operations.',
    patterns: {
      js: [/\bAbortController\b/, /\bAbortSignal\b/, /\bsignal\b/, /\.abort\(/],
      ts: [/\bAbortController\b/, /\bAbortSignal\b/, /\bsignal\b/, /\.abort\(/]
    },
    fileTypes: ['js', 'ts', 'jsx', 'tsx'],
    baseline: 'high'
  },
  'async-iterators': {
    name: 'Async Iterators',
    description: 'Asynchronous iterator objects are iterable with the for await .. of loop.',
    patterns: {
      js: [/for\s+await\s*\(/, /\basync\s+\*\s*/, /\byield\s+/, /\bSymbol\.asyncIterator\b/],
      ts: [/for\s+await\s*\(/, /\basync\s+\*\s*/, /\byield\s+/, /\bSymbol\.asyncIterator\b/]
    },
    fileTypes: ['js', 'ts', 'jsx', 'tsx'],
    baseline: 'high'
  },
  'js-modules': {
    name: 'ES Modules',
    description: 'JavaScript modules allow code to be organized into reusable units.',
    patterns: {
      js: [/import\s+/, /export\s+/, /from\s+['"`]/, /\bimport\.meta\b/],
      ts: [/import\s+/, /export\s+/, /from\s+['"`]/, /\bimport\.meta\b/]
    },
    fileTypes: ['js', 'ts', 'jsx', 'tsx'],
    baseline: 'high'
  },
  'container-queries': {
    name: 'Container Queries',
    description: 'Container size queries with the @container at-rule apply styles based on container dimensions.',
    patterns: {
      css: [/@container\b/, /\bcontainer-type\b/, /\bcontainer-name\b/]
    },
    fileTypes: ['css', 'scss', 'less'],
    baseline: 'low'
  }
};

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
        } else if (entry.isFile()) {
          yield fullPath;
        }
      }
    } catch (error) {
      // Skip directories we can't read
      continue;
    }
  }
}

// Main detection function
export function detectFeatures(options = {}) {
  const { srcDir, fileTypes = [], features = [] } = options;
  
  const found = new Set();
  const details = new Map();
  let totalFiles = 0;
  
  // Filter patterns if specific features requested
  const activePatterns = features.length > 0 
    ? Object.fromEntries(Object.entries(DETECTION_PATTERNS).filter(([id]) => features.includes(id)))
    : DETECTION_PATTERNS;
  
  // Walk through source directory
  for (const filePath of Array.from(walkDirectory(srcDir))) {
    const fileType = getFileType(filePath);
    
    // Skip files we don't care about
    if (fileType === 'other') continue;
    if (fileTypes.length > 0 && !fileTypes.includes(fileType)) continue;
    
    totalFiles++;
    
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      continue; // Skip files we can't read
    }
    
    // Check each feature pattern
    for (const [featureId, feature] of Object.entries(activePatterns)) {
      const patterns = feature.patterns[fileType];
      if (!patterns) continue;
      
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
  
  lines.push(`🎯 Unified Detection Summary`);
  lines.push(`Files scanned: ${result.summary.totalFiles}`);
  lines.push(`Features detected: ${result.summary.detectedFeatures}/${result.summary.totalFeatures}`);
  lines.push('');
  
  if (result.found.size > 0) {
    lines.push('🔍 Detected Features:');
    for (const featureId of Array.from(result.found)) {
      const feature = DETECTION_PATTERNS[featureId];
      const detail = result.details.get(featureId);
      const baselineIcon = feature.baseline === 'high' ? '🟢' : feature.baseline === 'low' ? '🟡' : '🔴';
      lines.push(`  ${baselineIcon} ${feature.name} (${detail.files.length} files)`);
    }
  } else {
    lines.push('❌ No features detected');
  }
  
  return lines.join('\n');
}

// Generate detectors from patterns (for compatibility with existing code)
export function generateDetectors() {
  return Object.entries(DETECTION_PATTERNS).map(([id, feature]) => ({
    id,
    name: feature.name,
    description: feature.description,
    patterns: new Map(Object.entries(feature.patterns)),
    fileTypes: feature.fileTypes,
    baseline: feature.baseline
  }));
}

// Export the main detection function as default
export { detectFeatures as default };
