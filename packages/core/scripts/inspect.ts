#!/usr/bin/env tsx

/**
 * SiteSentinel Inspection CLI
 *
 * Usage: pnpm inspect <image-path> [rule-pack]
 *
 * Example:
 *   pnpm inspect ./site.jpg construction
 *   pnpm inspect ./refinery.jpg oil-and-gas
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename, join, dirname } from 'path';
import { HazardDetectionPipeline } from '../src/pipeline/hazard-detection.js';
import { renderOverlay } from '../src/pipeline/overlay-renderer.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: pnpm inspect <image-path> [rule-pack]');
    console.error('');
    console.error('Rule packs:');
    console.error('  construction    - Construction sites (OSHA 1926)');
    console.error('  oil-and-gas     - Oil & gas facilities');
    console.error('');
    console.error('Environment variables:');
    console.error('  META_API_KEY      - Meta Model API key (for SAM + Spark)');
    console.error('  BASETEN_API_KEY   - Baseten API key (fallback for Spark only)');
    console.error('  PROVIDER          - "meta" or "baseten" (default: meta)');
    process.exit(1);
  }

  const imagePath = args[0];
  if (!imagePath) {
    console.error('Error: image path is required');
    process.exit(1);
  }
  const rulePackId = args[1] ?? 'construction';
  const provider = (process.env.PROVIDER ?? 'meta') as 'meta' | 'baseten';

  console.log('🏗️  SiteSentinel Hazard Inspection\n');
  console.log(`📸 Image: ${imagePath}`);
  console.log(`📋 Rule Pack: ${rulePackId}`);
  console.log(`🤖 Provider: ${provider}`);
  console.log('');

  // Check for API keys
  const metaApiKey = process.env.META_API_KEY;
  const basetenApiKey = process.env.BASETEN_API_KEY;

  if (provider === 'meta' && !metaApiKey) {
    console.error('❌ Error: META_API_KEY environment variable is required');
    console.error('');
    console.error('To run this inspection:');
    console.error('1. Get your API key from https://dev.meta.ai/');
    console.error('2. Set the environment variable:');
    console.error('   export META_API_KEY="your-key-here"');
    console.error('3. Run: pnpm inspect <image> <rule-pack>');
    console.error('');
    process.exit(1);
  }

  if (provider === 'baseten' && !basetenApiKey) {
    console.error('❌ Error: BASETEN_API_KEY environment variable is required');
    console.error('');
    console.error('To run this inspection:');
    console.error('1. Get your API key from https://baseten.co');
    console.error('2. Set the environment variable:');
    console.error('   export BASETEN_API_KEY="your-key-here"');
    console.error('3. Run: PROVIDER=baseten pnpm inspect <image> <rule-pack>');
    console.error('');
    process.exit(1);
  }

  try {
    // Load and convert image to base64
    console.log('📥 Loading image...');
    const imageBuffer = readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    // Initialize pipeline
    console.log('🔧 Initializing pipeline...\n');
    const pipeline = new HazardDetectionPipeline({
      metaApiKey,
      basetenApiKey,
    });

    // Run inspection
    console.log('🔍 Running inspection...');
    console.log('   - Loading safety rules');
    if (provider === 'meta') {
      console.log('   - Detecting objects with SAM 3.1');
    }
    console.log('   - Analyzing hazards with Muse Spark');
    console.log('');

    const result = await pipeline.inspect(dataUrl, {
      rulePackId,
      provider,
      reasoningEffort: 'low',
    });

    // Display results
    console.log('📊 Inspection Results\n');
    console.log(`Rule Pack: ${result.rulePack.name}`);
    console.log(`Findings: ${result.findings.length}`);
    console.log(`Provider: ${result.metadata.provider}`);
    console.log(
      `Image: ${result.metadata.imageSize.width}x${result.metadata.imageSize.height}`
    );
    console.log('');

    if (result.evidence.length > 0) {
      console.log('Evidence Detected:');
      result.evidence.forEach((e) => {
        console.log(`  • ${e.concept}: ${e.detections} detected`);
      });
      console.log('');
    }

    if (result.findings.length === 0) {
      console.log('✅ No hazards found\n');
    } else {
      console.log('⚠️  Hazards Found:\n');

      result.findings.forEach((finding, index) => {
        const icon = getSeverityIcon(finding.severity);
        console.log(`${index + 1}. ${icon} ${finding.title} [${finding.severity.toUpperCase()}]`);
        console.log(`   Confidence: ${finding.confidence}`);
        console.log(`   Rule: ${finding.ruleReference}`);
        console.log(`   Description: ${finding.description}`);
        console.log(
          `   Evidence Boxes: ${finding.evidenceBoxes.length} location(s)`
        );
        console.log(`   Fix: ${finding.recommendedFix}`);
        console.log('');
      });
    }

    // Save results
    const outputDir = dirname(imagePath);
    const baseName = basename(imagePath, '.jpg').replace(/\.(jpeg|png|gif)$/i, '');

    const jsonPath = join(
      outputDir,
      `${baseName}-${rulePackId}-${provider}-results.json`
    );
    writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    console.log(`💾 Results saved: ${jsonPath}`);

    // Render overlay
    if (result.findings.length > 0) {
      console.log('🎨 Rendering overlay...');
      const overlayBuffer = await renderOverlay(imageBuffer, result.findings);
      const overlayPath = join(
        outputDir,
        `${baseName}-${rulePackId}-${provider}-overlay.png`
      );
      writeFileSync(overlayPath, overlayBuffer);
      console.log(`🖼️  Overlay saved: ${overlayPath}`);
    }

    console.log('\n✅ Inspection complete!\n');
  } catch (error) {
    console.error('❌ Inspection failed:', error);
    process.exit(1);
  }
}

function getSeverityIcon(severity: string): string {
  const icons: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };
  return icons[severity] ?? '⚪';
}

void main();
