#!/usr/bin/env node
import detectFeatures, { formatDetectionResults } from './detection-api.js';

console.log('🧪 Testing Unified Detection API\n');

try {
  const result = detectFeatures({ 
    srcDir: './tests/fixtures/modern-app' 
  });
  
  console.log(formatDetectionResults(result));
  
  console.log('\n📊 Detailed Results:');
  for (const [featureId, detail] of result.details) {
    console.log(`\n${featureId}:`);
    console.log(`  Files: ${detail.files.length}`);
    console.log(`  Matches: ${detail.matches.slice(0, 3).join(', ')}${detail.matches.length > 3 ? '...' : ''}`);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}
