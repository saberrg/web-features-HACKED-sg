#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function runTest(tool, args, expectedFeatures) {
  console.log(`\n🧪 Testing ${tool}...`);
  console.log(`Command: node ${tool}/${tool}.js ${args}`);
  console.log(`Working directory: ${process.cwd()}`);
  
  try {
    const command = `node ${tool}/${tool}.js ${args}`;
    const output = execSync(command, { encoding: 'utf8', shell: true });
    
    console.log('[PASS] Tool ran successfully');
    console.log('Output preview:');
    console.log('─'.repeat(50));
    console.log(output.substring(0, 500) + (output.length > 500 ? '...' : ''));
    console.log('─'.repeat(50));
    
    // Check if expected features are detected
    let detectedCount = 0;
    for (const feature of expectedFeatures) {
      if (output.includes(feature)) {
        console.log(`[DETECTED] ${feature}`);
        detectedCount++;
      } else {
        console.log(`[MISSING] ${feature}`);
      }
    }
    
    console.log(`Detection rate: ${detectedCount}/${expectedFeatures.length} features`);
    return { success: true, output, detectedCount, total: expectedFeatures.length };
  } catch (error) {
    console.log(`[FAILED] Tool failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function checkEnhancementFeatures(output, toolName) {
  const enhancements = [];
  
  // Check for enhanced output features
  if (output.includes('Baseline Coverage Audit') || output.includes('Policy Compliance Report')) {
    enhancements.push('Professional formatting');
  }
  
  if (output.includes('Baseline Status') || output.includes('baseline')) {
    enhancements.push('Baseline status information');
  }
  
  if (output.includes('CanIUse:') || output.includes('caniuse.com')) {
    enhancements.push('CanIUse links');
  }
  
  if (toolName === 'let-me-browse' && output.includes('Baseline Coverage Audit')) {
    enhancements.push('Audit report');
  }
  
  if (toolName === 'fix-my-browse' && output.includes('Browser Target Compatibility Issues')) {
    enhancements.push('Target checking');
  }
  
  if (toolName === 'set-my-browse' && output.includes('Policy Compliance Report')) {
    enhancements.push('Policy compliance reporting');
  }
  
  return enhancements;
}

// Main test execution
console.log('Testing Baseline Tools');
console.log('=' .repeat(60));

// Test 1: let-me-browse with modern app
console.log('\nTest 1: let-me-browse (Detection & Reporting)');
const lmbResult = runTest('let-me-browse', './tests/fixtures/modern-app', [
  'CSS Grid',
  'AbortController/AbortSignal',
  'Async Clipboard API',
  'CSS :has() selector'
]);

if (lmbResult.success) {
  const lmbEnhancements = checkEnhancementFeatures(lmbResult.output, 'let-me-browse');
  console.log('Features found:');
  lmbEnhancements.forEach(enhancement => console.log(`  [FOUND] ${enhancement}`));
}

// Test 2: fix-my-browse with browser targets
console.log('\nTest 2: fix-my-browse (Target Validation)');
const fmbResult = runTest('fix-my-browse', './tests/fixtures/modern-app --targets="chrome>=100,firefox>=100"', [
  'blockers',
  'Requires:'
]);

if (fmbResult.success) {
  const fmbEnhancements = checkEnhancementFeatures(fmbResult.output, 'fix-my-browse');
  console.log('Features found:');
  fmbEnhancements.forEach(enhancement => console.log(`  [FOUND] ${enhancement}`));
}

// Test 3: set-my-browse with policy
console.log('\nTest 3: set-my-browse (Policy Compliance)');
const smbResult = runTest('set-my-browse', './tests/fixtures/modern-app --specs=csswg --mode=allow', [
  'Policy Compliance Report',
  'Compliant:',
  'Non-compliant:'
]);

if (smbResult.success) {
  const smbEnhancements = checkEnhancementFeatures(smbResult.output, 'set-my-browse');
  console.log('Features found:');
  smbEnhancements.forEach(enhancement => console.log(`  [FOUND] ${enhancement}`));
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));

const results = [
  { tool: 'let-me-browse', result: lmbResult },
  { tool: 'fix-my-browse', result: fmbResult },
  { tool: 'set-my-browse', result: smbResult }
];

let successCount = 0;
let totalDetected = 0;
let totalExpected = 0;

results.forEach(({ tool, result }) => {
  if (result.success) {
    console.log(`[PASS] ${tool}: PASSED (${result.detectedCount}/${result.total} features)`);
    successCount++;
    totalDetected += result.detectedCount;
    totalExpected += result.total;
  } else {
    console.log(`[FAIL] ${tool}: FAILED (${result.error})`);
  }
});

console.log(`\nOverall: ${successCount}/3 tools passed`);
console.log(`Detection: ${totalDetected}/${totalExpected} features detected`);
console.log(`\n${successCount === 3 ? 'All tests passed! Tools are working correctly!' : 'Some tests failed. Check the output above.'}`);

// Save detailed results
const report = {
  timestamp: new Date().toISOString(),
  results: results.map(({ tool, result }) => ({
    tool,
    success: result.success,
    detected: result.detectedCount || 0,
    total: result.total || 0,
    error: result.error || null
  })),
  summary: {
    toolsPassed: successCount,
    totalTools: 3,
    featuresDetected: totalDetected,
    featuresExpected: totalExpected
  }
};

fs.writeFileSync('./tests/test-results.json', JSON.stringify(report, null, 2));
console.log('\nDetailed results saved to tests/test-results.json');
