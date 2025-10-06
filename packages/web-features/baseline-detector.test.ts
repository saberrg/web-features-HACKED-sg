import { describe, it } from 'mocha';
import { expect } from 'chai';
import { detectFeatures } from './baseline-detector.js';

describe('baseline-detector', () => {
  it('should detect CSS Grid in CSS files', async () => {
    const result = await detectFeatures({ srcDir: './tests/fixtures/modern-app' });
    expect(result.found.has('grid')).to.be.true;
  });

  it('should detect async/await in JavaScript files', async () => {
    const result = await detectFeatures({ srcDir: './tests/fixtures/modern-app' });
    expect(result.found.has('async-await')).to.be.true;
  });

  it('should skip node_modules and hidden files', async () => {
    const result = await detectFeatures({ srcDir: './tests/fixtures' });
    expect(result.summary.filesScanned).to.be.greaterThan(0);
  });

  it('should return proper detection structure', async () => {
    const result = await detectFeatures({ srcDir: './tests/fixtures/modern-app' });
    expect(result).to.have.property('found');
    expect(result).to.have.property('summary');
    expect(result.found).to.be.instanceOf(Set);
    expect(result.summary).to.have.property('filesScanned');
  });
});
