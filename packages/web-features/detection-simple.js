#!/usr/bin/env node
/**
 * Simple Unified Detection API for Baseline Web Features
 * Hackathon version - simplified for quick implementation
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Simple detection patterns for key features
const DETECTION_PATTERNS = {
  'fetch': {
    name: 'Fetch',
    patterns: {
      js: [/\bfetch\s*\(/, /\bResponse\b/, /\bRequest\b/],
      ts: [/\bfetch\s*\(/, /\bResponse\b/, /\bRequest\b/]
    }
  },
  'grid': {
    name: 'CSS Grid',
    patterns: {
      css: [/display\s*:\s*grid\b/, /\bgrid-template\b/, /\bgrid-area\b/]
    }
  },
  'has': {
    name: 'CSS :has()',
    patterns: {
      css: [/\:has\(/]
    }
  },
  'async-clipboard': {
    name: 'Async Clipboard',
    patterns: {
      js: [/\bnavigator\.clipboard\b/, /\bClipboardItem\b/],
      ts: [/\bnavigator\.clipboard\b/, /\bClipboardItem\b/]
    }
  },
  'aborting': {
    name: 'AbortController',
    patterns: {
      js: [/\bAbortController\b/, /\bAbortSignal\b/],
      ts: [/\bAbortController\b/, /\bAbortSignal\b/]
    }
  },
  'async-iterators': {
    name: 'Async Iterators',
    patterns: {
      js: [/for\s+await\s*\(/, /\basync\s+\*\s*/],
      ts: [/for\s+await\s*\(/, /\basync\s+\*\s*/]
    }
  },
  'js-modules': {
    name: 'ES Modules',
    patterns: {
      js: [/import\s+/, /export\s+/, /from\s+['"`]/],
      ts: [/import\s+/, /export\s+/, /from\s+['"`]/]
    }
  },
  'container-queries': {
    name: 'Container Queries',
    patterns: {
      css: [/@container\b/, /\bcontainer-type\b/]
    }
  }
};

function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.js': return 'js';
    case '.ts': return 'ts';
    case '.jsx': return 'jsx';
    case '.tsx': return 'tsx';
    case '.css': return 'css';
    case '.scss': return 'css';
    case '.less': return 'css';
    default: return 'other';
  }
}

function* walkDirectory(dir) {
  const stack = [dir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            stack.push(fullPath);
          }
        } else if (entry.isFile()) {
          yield fullPath;
        }
      }
    } catch (error) {
      continue;
    }
  }
}

export function detectFeatures(options = {}) {
  const { srcDir, fileTypes = [], features = [] } = options;
  
  const found = new Set();
  const details = new Map();
  let totalFiles = 0;
  
  // Walk through source directory
  for (const filePath of Array.from(walkDirectory(srcDir))) {
    const fileType = getFileType(filePath);
    
    if (fileType === 'other') continue;
    if (fileTypes.length > 0 && !fileTypes.includes(fileType)) continue;
    
    totalFiles++;
    
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      continue;
    }
    
    // Check each feature pattern
    for (const [featureId, feature] of Object.entries(DETECTION_PATTERNS)) {
      if (features.length > 0 && !features.includes(featureId)) continue;
      
      const patterns = feature.patterns[fileType];
      if (!patterns) continue;
      
      let hasMatch = false;
      const matches = [];
      
      for (const pattern of patterns) {
        const match = pattern.exec(fileContent);
        if (match) {
          hasMatch = true;
          matches.push(match[0]);
        }
        pattern.lastIndex = 0; // Reset regex state
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
      totalFeatures: Object.keys(DETECTION_PATTERNS).length,
      detectedFeatures: found.size
    }
  };
}

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
      lines.push(`  ✅ ${feature.name} (${detail.files.length} files)`);
    }
  } else {
    lines.push('❌ No features detected');
  }
  
  return lines.join('\n');
}

export default detectFeatures;
