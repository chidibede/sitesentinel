#!/usr/bin/env tsx

/**
 * Smoke test for SiteSentinel hazard detection
 *
 * Sends a sample construction site image to Muse Spark Open on Baseten
 * and validates that it returns structured hazard detection results.
 *
 * Usage: pnpm smoke
 * Required env: BASETEN_API_KEY
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BasetenProvider } from '../src/models/baseten.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Hazard {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

async function runSmokeTest() {
  console.log('🏗️  SiteSentinel Smoke Test\n');

  // Check for API key
  const apiKey = process.env.BASETEN_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: BASETEN_API_KEY environment variable is required');
    console.error('\nTo run this test:');
    console.error('1. Sign up at https://baseten.co');
    console.error('2. Get your API key from the dashboard');
    console.error('3. Set the environment variable:');
    console.error('   export BASETEN_API_KEY="your-key-here"');
    console.error('4. Run: pnpm smoke\n');
    process.exit(1);
  }

  // Check for test image
  const imagePath = join(__dirname, '../test/fixtures/construction-site.jpg');
  if (!existsSync(imagePath)) {
    console.error('❌ Error: Test image not found at', imagePath);
    console.error('\nPlease download a construction site image from:');
    console.error(
      'https://pixabay.com/photos/construction-site-crane-1391538/'
    );
    console.error('See test/fixtures/IMAGE_SOURCE.md for details.\n');
    process.exit(1);
  }

  console.log('📸 Loading test image:', imagePath);

  // Convert image to base64 data URL
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;

  console.log('🤖 Initializing Baseten provider (Muse Spark Open)...\n');

  const provider = new BasetenProvider({
    apiKey,
    model: 'meta-models/muse-spark-open-1026',
  });

  const prompt = `You are a safety inspector analyzing a construction site image.

Identify all potential safety hazards in this image and return them as a JSON array.
Each hazard should have:
- type: category of hazard (e.g., "missing_ppe", "unsafe_conditions", "equipment_hazard")
- description: specific description of what you observe
- severity: one of "low", "medium", "high", or "critical"

Example format:
[
  {
    "type": "missing_ppe",
    "description": "Worker without hard hat near crane operation",
    "severity": "high"
  }
]

Return ONLY the JSON array, no other text.`;

  try {
    console.log('🔍 Analyzing image for hazards...\n');

    const response = await provider.generateCompletion([
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: dataUrl },
        ],
      },
    ]);

    console.log('📊 Response received\n');

    if (response.reasoning) {
      console.log('💭 Model reasoning:');
      console.log(response.reasoning.substring(0, 200) + '...\n');
    }

    if (!response.content) {
      console.error('❌ No content in response');
      process.exit(1);
    }

    // Parse hazards from response
    const hazards = parseHazards(response.content);

    console.log('✅ Hazards detected:', hazards.length);
    console.log('\n📋 Detected hazards:\n');
    console.log(JSON.stringify(hazards, null, 2));

    if (response.usage) {
      console.log('\n📈 Token usage:');
      console.log(`   Prompt: ${response.usage.promptTokens}`);
      console.log(`   Completion: ${response.usage.completionTokens}`);
      console.log(`   Total: ${response.usage.totalTokens}`);
    }

    console.log('\n✅ Smoke test passed!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

function parseHazards(content: string): Hazard[] {
  // Extract JSON array from markdown code blocks or plain text
  const jsonMatch =
    content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) ??
    content.match(/(\[[\s\S]*?\])/);

  if (!jsonMatch?.[1]) {
    throw new Error('No JSON array found in response');
  }

  const parsed = JSON.parse(jsonMatch[1]) as unknown;

  // Validate structure
  if (!Array.isArray(parsed)) {
    throw new Error('Response is not an array');
  }

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Invalid hazard: not an object');
    }
    const h = item as Record<string, unknown>;
    if (
      typeof h.type !== 'string' ||
      typeof h.description !== 'string' ||
      typeof h.severity !== 'string' ||
      !['low', 'medium', 'high', 'critical'].includes(h.severity)
    ) {
      throw new Error('Invalid hazard structure: ' + JSON.stringify(item));
    }
  }

  return parsed as Hazard[];
}

// Run the test
void runSmokeTest().catch((error: unknown) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
