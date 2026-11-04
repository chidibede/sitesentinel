#!/usr/bin/env node
/**
 * Agent Loop CLI
 *
 * Usage: pnpm loop <before.jpg> <after.jpg> [--pack construction|oil-and-gas] [--zone area-1]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import { HazardDetectionPipeline } from '../src/pipeline/hazard-detection-v2.js';
import { MetaModelAPIProvider } from '../src/models/meta-model-api.js';
import { BasetenProvider } from '../src/models/baseten.js';
import { loadRulePack } from '../src/safety-rules/rule-packs-v2.js';
import { AgentLoop } from '../src/agent/agent-loop.js';
import { InMemoryIssueStore, loadSiteRoster } from '../src/agent/issue-manager.js';
import { renderDetectionBoxes } from '../src/pipeline/overlay-renderer.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: pnpm loop <before.jpg> <after.jpg> [options]');
    console.error('Options:');
    console.error('  --pack <id>      Rule pack: construction (default) or oil-and-gas');
    console.error('  --zone <name>    Site zone (default: site-main)');
    console.error('  --provider <p>   Provider: meta (default) or baseten');
    process.exit(1);
  }

  const beforePath = resolve(args[0] ?? '');
  const afterPath = resolve(args[1] ?? '');

  let rulePackId = 'construction';
  let zone = 'site-main';
  let providerName = 'meta';

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--pack' && args[i + 1]) {
      rulePackId = args[i + 1] ?? 'construction';
      i++;
    } else if (args[i] === '--zone' && args[i + 1]) {
      zone = args[i + 1] ?? 'site-main';
      i++;
    } else if (args[i] === '--provider' && args[i + 1]) {
      providerName = args[i + 1] ?? 'meta';
      i++;
    }
  }

  console.log('SiteSentinel Agent Loop');
  console.log('=======================');
  console.log(`Before: ${beforePath}`);
  console.log(`After:  ${afterPath}`);
  console.log(`Pack:   ${rulePackId}`);
  console.log(`Zone:   ${zone}`);
  console.log(`Provider: ${providerName}`);
  console.log();

  // Load images
  const beforeBuffer = readFileSync(beforePath);
  const afterBuffer = readFileSync(afterPath);

  // Load rule pack
  const rulePack = loadRulePack(rulePackId);
  console.log(`Loaded rule pack: ${rulePack.name} (${rulePack.rules.length} rules)`);

  // Create provider
  const apiKey = process.env.META_API_KEY || process.env.BASETEN_API_KEY || '';
  if (!apiKey) {
    console.error('Error: META_API_KEY or BASETEN_API_KEY must be set');
    process.exit(1);
  }

  let samProvider;
  let sparkProvider;

  if (providerName === 'baseten') {
    sparkProvider = new BasetenProvider({
      baseURL: 'https://inference.baseten.co/v1',
      apiKey,
    });
    console.log('Using Baseten for Muse Spark (SAM not available on Baseten)');
  } else {
    samProvider = new MetaModelAPIProvider({
      baseURL: 'https://api.meta.ai/v1',
      apiKey,
    });
    sparkProvider = new MetaModelAPIProvider({
      baseURL: 'https://api.meta.ai/v1',
      apiKey,
    });
    console.log('Using Meta Model API for SAM 3.1 and Muse Spark 1.3');
  }

  // Create pipeline
  const pipeline = new HazardDetectionPipeline({
    samProvider: samProvider ?? undefined,
    sparkProvider,
    rulePack,
  });

  // Create issue store
  const issueStore = new InMemoryIssueStore();

  // Load site roster
  const roster = loadSiteRoster('demo-site');

  // Create agent loop
  const agent = new AgentLoop({
    pipeline,
    issueStore,
    roster,
    siteId: 'demo-site',
  });

  console.log();
  console.log('Running agent loop...');
  console.log();

  const startTime = Date.now();

  try {
    const result = await agent.runFullLoop(
      beforeBuffer,
      beforePath,
      afterBuffer,
      afterPath,
      zone
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(result.summary);
    console.log();
    console.log(`Completed in ${elapsed}s`);
    console.log();

    // Render overlays
    mkdirSync('./out', { recursive: true });
    const beforeBaseName = basename(beforePath, '.jpg').replace(/\.(jpeg|png)$/i, '');
    const afterBaseName = basename(afterPath, '.jpg').replace(/\.(jpeg|png)$/i, '');
    const beforeOverlayPath = `./out/${beforeBaseName}-${rulePackId}-before-overlay.png`;
    const afterOverlayPath = `./out/${afterBaseName}-${rulePackId}-after-overlay.png`;

    if (result.detectionResult.issues.length > 0) {
      console.log('🎨 Rendering overlays...');
      
      // Before image overlay
      const beforeBoxes = result.detectionResult.issues.flatMap(issue => issue.evidenceBoxes);
      const beforeLabels = result.detectionResult.issues.flatMap(issue => 
        issue.evidenceBoxes.map(() => issue.title)
      );
      
      if (beforeBoxes.length > 0) {
        const beforeOverlay = await renderDetectionBoxes(
          beforeBuffer,
          beforeBoxes,
          beforeLabels
        );
        writeFileSync(beforeOverlayPath, beforeOverlay);
        console.log(`   ✓ Before: ${beforeOverlayPath}`);
      }

      // After image overlay (re-detect to get current boxes)
      const afterFindings = await pipeline.detect(afterBuffer);
      if (afterFindings.length > 0) {
        const afterBoxes = afterFindings.flatMap(f => f.evidenceBoxes);
        const afterLabels = afterFindings.flatMap(f => 
          f.evidenceBoxes.map(() => f.rule.title)
        );
        
        const afterOverlay = await renderDetectionBoxes(
          afterBuffer,
          afterBoxes,
          afterLabels
        );
        writeFileSync(afterOverlayPath, afterOverlay);
        console.log(`   ✓ After: ${afterOverlayPath}`);
      }

      console.log();
    }

    // Print detailed audit trail
    console.log('Detailed Audit Trail:');
    console.log('=====================');

    for (const issue of result.detectionResult.issues) {
      console.log();
      console.log(`Issue: ${issue.id}`);
      console.log(`  Title: ${issue.title}`);
      console.log(`  Category: ${issue.category}`);
      console.log(`  Risk: ${issue.riskAssessment.riskBand.toUpperCase()} (Score: ${issue.riskAssessment.riskScore})`);
      console.log(`  Assigned: ${issue.assignedTo ?? 'Unassigned'} (${issue.assignedRole ?? 'N/A'})`);
      console.log(`  Voice Alert: ${issue.voiceAlert}`);
      console.log();
      console.log('  Detection & Assignment Audit:');

      for (const entry of issue.auditTrail) {
        console.log(`    [${entry.timestamp}] ${entry.action} by ${entry.actor}`);
        if (Object.keys(entry.details).length > 0) {
          console.log(`      Details: ${JSON.stringify(entry.details)}`);
        }
      }
    }

    console.log();
    console.log('Verification Results:');
    console.log('=====================');

    for (let i = 0; i < result.verificationResults.length; i++) {
      const verification = result.verificationResults[i];
      const issue = result.detectionResult.issues[i];
      
      if (!verification || !issue) continue;
      
      console.log();
      console.log(`Issue ${i + 1}: ${issue.title}`);
      console.log(`  Status: ${verification.resolved ? 'RESOLVED ✓' : 'UNRESOLVED ✗'}`);
      console.log(`  Reason: ${verification.reason}`);
      console.log();
      console.log('  Verification Audit:');

      for (const entry of verification.auditTrail) {
        console.log(`    [${entry.timestamp}] ${entry.action}`);
      }
    }

    console.log();
  } catch (error) {
    console.error('Error running agent loop:', error);
    process.exit(1);
  }
}

void main();
