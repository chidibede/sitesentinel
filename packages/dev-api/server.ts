/**
 * Local Development API Server
 *
 * Runs a local API server on :3001 for development without AWS deployment.
 * Uses in-memory issue store and local file storage for overlays.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { HazardDetectionPipeline } from '@sitesentinel/core/src/pipeline/hazard-detection-v2.js';
import { MetaModelAPIProvider } from '@sitesentinel/core/src/models/meta-model-api.js';
import { BasetenProvider } from '@sitesentinel/core/src/models/baseten.js';
import { loadRulePack } from '@sitesentinel/core/src/safety-rules/rule-packs-v2.js';
import { AgentLoop } from '@sitesentinel/core/src/agent/agent-loop.js';
import { InMemoryIssueStore, loadSiteRoster } from '@sitesentinel/core/src/agent/issue-manager.js';
import { MuseVoiceTranscribe } from '@sitesentinel/core/src/agent/voice-services.js';
import { renderDetectionBoxes } from '@sitesentinel/core/src/pipeline/overlay-renderer.js';
import type { Issue } from '@sitesentinel/core/src/agent/issue-manager.js';

const app = new Hono();

// Global issue store for dev
const issueStore = new InMemoryIssueStore();

// Output directory for overlays
const OUT_DIR = './dev-api-out';
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

// CORS
app.use('/*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'SiteSentinel Dev API',
    timestamp: new Date().toISOString(),
    version: '4.0.0-dev',
  });
});

// POST /inspect
app.post('/inspect', async (c) => {
  try {
    const body = await c.req.json();

    if (!body.image) {
      return c.json({ error: 'image field required' }, 400);
    }

    const imageBuffer = decodeImageData(body.image);
    const rulePackId = body.rulePackId ?? 'construction';
    const zone = body.zone ?? 'site-main';
    const siteId = body.siteId ?? 'default-site';
    const provider = body.provider ?? 'meta';

    const metaApiKey = process.env.META_API_KEY ?? '';
    const basetenApiKey = process.env.BASETEN_API_KEY ?? '';

    const { samProvider, sparkProvider } = createProviders(
      provider,
      metaApiKey,
      basetenApiKey
    );

    const rulePack = loadRulePack(rulePackId);
    const pipeline = new HazardDetectionPipeline({
      samProvider,
      sparkProvider,
      rulePack,
    });

    const roster = loadSiteRoster(siteId);
    const agent = new AgentLoop({ pipeline, issueStore, roster, siteId });

    const imageUrl = `local://images/${Date.now()}.jpg`;
    const result = await agent.detectAndCreateIssues(imageBuffer, zone, imageUrl);

    let overlayUrl: string | undefined;
    if (body.returnOverlay !== false && result.issues.length > 0) {
      const boxes = result.issues.flatMap(issue => issue.evidenceBoxes);
      const labels = result.issues.flatMap(issue => 
        issue.evidenceBoxes.map(() => issue.title)
      );
      
      if (boxes.length > 0) {
        const overlayBuffer = await renderDetectionBoxes(imageBuffer, boxes, labels);
        const overlayFilename = `overlay-${Date.now()}.png`;
        const overlayPath = join(OUT_DIR, overlayFilename);
        writeFileSync(overlayPath, overlayBuffer);
        overlayUrl = `http://localhost:3001/overlays/${overlayFilename}`;
      }
    }

    return c.json({
      issues: result.issues.map((issue: Issue) => ({
        id: issue.id,
        title: issue.title,
        category: issue.category,
        riskBand: issue.riskAssessment.riskBand,
        riskScore: issue.riskAssessment.riskScore,
        assignedTo: issue.assignedTo,
        status: issue.status,
        voiceAlert: issue.voiceAlert,
        imageUrl: issue.imageUrl,
        evidenceBoxes: issue.evidenceBoxes,
      })),
      auditTrail: result.auditTrail,
      overlayUrl,
    });
  } catch (error) {
    console.error('Inspection failed:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// GET /issues
app.get('/issues', async (c) => {
  try {
    const siteId = c.req.query('siteId');
    const status = c.req.query('status') as Issue['status'] | undefined;
    const zone = c.req.query('zone');

    const issues = await issueStore.list({ siteId, status, zone });

    return c.json({
      issues: issues.map((issue: Issue) => ({
        id: issue.id,
        title: issue.title,
        category: issue.category,
        riskBand: issue.riskAssessment.riskBand,
        riskScore: issue.riskAssessment.riskScore,
        zone: issue.zone,
        status: issue.status,
        assignedTo: issue.assignedTo,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        resolvedAt: issue.resolvedAt,
        imageUrl: issue.imageUrl,
        evidenceBoxes: issue.evidenceBoxes,
        auditTrail: issue.auditTrail,
        verificationImages: issue.verificationImages,
      })),
      count: issues.length,
    });
  } catch (error) {
    console.error('Failed to list issues:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// POST /issues/:id/verify
app.post('/issues/:id/verify', async (c) => {
  try {
    const issueId = c.req.param('id');
    const body = await c.req.json();

    if (!body.afterImage) {
      return c.json({ error: 'afterImage field required' }, 400);
    }

    const afterImageBuffer = decodeImageData(body.afterImage);
    const provider = body.provider ?? 'meta';

    const issue = await issueStore.get(issueId);
    if (!issue) {
      return c.json({ error: 'Issue not found' }, 404);
    }

    const metaApiKey = process.env.META_API_KEY ?? '';
    const basetenApiKey = process.env.BASETEN_API_KEY ?? '';

    const { samProvider, sparkProvider } = createProviders(
      provider,
      metaApiKey,
      basetenApiKey
    );

    const rulePack = loadRulePack('construction');
    const pipeline = new HazardDetectionPipeline({
      samProvider,
      sparkProvider,
      rulePack,
    });

    const roster = loadSiteRoster(issue.siteId);
    const agent = new AgentLoop({
      pipeline,
      issueStore,
      roster,
      siteId: issue.siteId,
    });

    const afterImageUrl = `local://verifications/${Date.now()}.jpg`;
    const verification = await agent.verifyFix(
      issueId,
      afterImageBuffer,
      afterImageUrl
    );

    let overlayUrl: string | undefined;
    const afterFindings = await pipeline.detect(afterImageBuffer);
    if (afterFindings.length > 0) {
      const boxes = afterFindings.flatMap(f => f.evidenceBoxes);
      const labels = afterFindings.flatMap(f => 
        f.evidenceBoxes.map(() => f.rule.title)
      );
      
      if (boxes.length > 0) {
        const overlayBuffer = await renderDetectionBoxes(afterImageBuffer, boxes, labels);
        const overlayFilename = `verify-overlay-${Date.now()}.png`;
        const overlayPath = join(OUT_DIR, overlayFilename);
        writeFileSync(overlayPath, overlayBuffer);
        overlayUrl = `http://localhost:3001/overlays/${overlayFilename}`;
      }
    }

    return c.json({
      ...verification,
      afterImageUrl,
      overlayUrl,
    });
  } catch (error) {
    console.error('Verification failed:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// POST /reports/voice
app.post('/reports/voice', async (c) => {
  try {
    const body = await c.req.json();

    if (!body.audio) {
      return c.json({ error: 'audio field required' }, 400);
    }

    const audioBuffer = Buffer.from(body.audio, 'base64');
    const siteId = body.siteId ?? 'default-site';
    const zone = body.zone ?? 'site-main';

    const metaApiKey = process.env.META_API_KEY ?? '';

    const transcriber = new MuseVoiceTranscribe({
      baseURL: 'https://api.meta.ai/v1',
      apiKey: metaApiKey,
      model: 'muse-voice-transcribe-1.0',
    });

    const transcription = await transcriber.transcribe(audioBuffer);

    return c.json({
      transcription: transcription.text,
      siteId,
      zone,
      message: 'Voice report received. Manual issue creation required.',
    });
  } catch (error) {
    console.error('Transcription failed:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Serve overlay files
app.get('/overlays/:filename', async (c) => {
  const filename = c.req.param('filename');
  const filepath = join(OUT_DIR, filename);
  
  if (!existsSync(filepath)) {
    return c.json({ error: 'File not found' }, 404);
  }

  const fs = await import('fs/promises');
  const file = await fs.readFile(filepath);
  
  return new Response(file, {
    headers: {
      'Content-Type': 'image/png',
    },
  });
});

// Helper functions
function decodeImageData(imageData: string): Buffer {
  if (imageData.startsWith('data:')) {
    const base64 = imageData.split(',')[1];
    if (!base64) {
      throw new Error('Invalid image data URL');
    }
    return Buffer.from(base64, 'base64');
  }
  return Buffer.from(imageData, 'base64');
}

function createProviders(
  provider: 'meta' | 'baseten',
  metaApiKey: string,
  basetenApiKey: string
) {
  let samProvider;
  let sparkProvider;

  if (provider === 'baseten') {
    sparkProvider = new BasetenProvider({
      baseURL: 'https://inference.baseten.co/v1',
      apiKey: basetenApiKey,
    });
  } else {
    samProvider = new MetaModelAPIProvider({
      baseURL: 'https://api.meta.ai/v1',
      apiKey: metaApiKey,
    });
    sparkProvider = new MetaModelAPIProvider({
      baseURL: 'https://api.meta.ai/v1',
      apiKey: metaApiKey,
    });
  }

  return { samProvider, sparkProvider };
}

// Start server
const port = 3001;
console.log(`🚀 SiteSentinel Dev API running on http://localhost:${port}`);
console.log(`   Health: http://localhost:${port}/health`);
console.log(`   Overlays stored in: ${OUT_DIR}`);

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
serve({
  fetch: app.fetch,
  port,
});
