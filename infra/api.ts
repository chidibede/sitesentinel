/**
 * SiteSentinel API Handler - Agent Loop Edition
 *
 * Lambda function with agentic workflow endpoints
 */

import { Resource } from 'sst';
import { HazardDetectionPipeline } from '@sitesentinel/core/src/pipeline/hazard-detection-v2.js';
import { MetaModelAPIProvider } from '@sitesentinel/core/src/models/meta-model-api.js';
import { BasetenProvider } from '@sitesentinel/core/src/models/baseten.js';
import { loadRulePack } from '@sitesentinel/core/src/safety-rules/rule-packs-v2.js';
import { AgentLoop } from '@sitesentinel/core/src/agent/agent-loop.js';
import { DynamoDBIssueStore } from '@sitesentinel/core/src/storage/dynamodb-store.js';
import type { Issue } from '@sitesentinel/core/src/agent/issue-manager.js';
import { loadSiteRoster } from '@sitesentinel/core/src/agent/issue-manager.js';
import { MuseVoiceTranscribe } from '@sitesentinel/core/src/agent/voice-services.js';
import { S3Storage } from '@sitesentinel/core/src/storage/s3-storage.js';
import { renderDetectionBoxes } from '@sitesentinel/core/src/pipeline/overlay-renderer.js';

interface RequestEvent {
  requestContext: { http: { method: string; path: string } };
  body?: string;
  pathParameters?: Record<string, string>;
  rawQueryString?: string;
  queryStringParameters?: Record<string, string>;
}

const DEFAULT_SITE_ID = 'demo-site';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handler(event: RequestEvent) {
  const { method, path } = event.requestContext.http;

  // Handle preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  // Health check
  if (method === 'GET' && path === '/health') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        status: 'healthy',
        service: 'SiteSentinel Agent API',
        timestamp: new Date().toISOString(),
        version: '4.0.0-web-glasses',
      }),
    };
  }

  // POST /inspect - Create issues from detection
  if (method === 'POST' && path === '/inspect') {
    return await handleInspect(event);
  }

  // GET /issues - List issues
  if (method === 'GET' && path === '/issues') {
    return await handleListIssues(event);
  }

  // POST /issues/{id}/verify - Verify fix
  if (method === 'POST' && path.startsWith('/issues/') && path.endsWith('/verify')) {
    return await handleVerifyFix(event);
  }

  // POST /reports/voice - Voice report transcription
  if (method === 'POST' && path === '/reports/voice') {
    return await handleVoiceReport(event);
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify({
      error: 'Not Found',
      availableEndpoints: [
        'GET /health',
        'POST /inspect',
        'GET /issues',
        'POST /issues/{id}/verify',
        'POST /reports/voice',
      ],
    }),
  };
}

/**
 * POST /inspect - Run detection and create issues
 */
async function handleInspect(event: RequestEvent) {
  try {
    if (!event.body) {
      return errorResponse(400, 'Request body required');
    }

    const body = JSON.parse(event.body) as {
      image: string;
      rulePackId?: string;
      zone?: string;
      siteId?: string;
      provider?: 'meta' | 'baseten';
      returnOverlay?: boolean;
    };

    if (!body.image) {
      return errorResponse(400, 'image field required (base64 or data URL)');
    }

    const imageBuffer = decodeImageData(body.image);
    const rulePackId = body.rulePackId ?? 'construction';
    const zone = body.zone ?? 'site-main';
    const siteId = body.siteId ?? DEFAULT_SITE_ID;
    const provider = body.provider ?? 'meta';

    // Get resources
    const metaApiKey = getResourceValue('MetaApiKey');
    const basetenApiKey = getResourceValue('BasetenApiKey');
    const issuesTableName = getResourceValue('IssuesTable');
    const imagesBucketName = getResourceValue('ImagesBucket');

    // Upload image to S3
    const s3Storage = new S3Storage({ bucketName: imagesBucketName });
    const imageKey = await s3Storage.uploadImage(imageBuffer, 'image/jpeg', 'inspections');
    const imageUrl = s3Storage.getPublicUrl(imageKey);

    // Create providers
    const { samProvider, sparkProvider } = createProviders(
      provider,
      metaApiKey,
      basetenApiKey
    );

    // Create pipeline
    const rulePack = loadRulePack(rulePackId);
    const pipeline = new HazardDetectionPipeline({
      samProvider,
      sparkProvider,
      rulePack,
    });

    // Create agent loop
    const issueStore = new DynamoDBIssueStore(issuesTableName);
    const roster = loadSiteRoster(siteId);
    const agent = new AgentLoop({ pipeline, issueStore, roster, siteId });

    // Run detection and create issues
    const result = await agent.detectAndCreateIssues(
      imageBuffer,
      zone,
      imageUrl
    );

    // Render overlay
    let overlayUrl: string | undefined;
    if (body.returnOverlay !== false && result.issues.length > 0) {
      const boxes = result.issues.flatMap(issue => issue.evidenceBoxes);
      const labels = result.issues.flatMap(issue => 
        issue.evidenceBoxes.map(() => issue.title)
      );
      
      if (boxes.length > 0) {
        const overlayBuffer = await renderDetectionBoxes(imageBuffer, boxes, labels);
        const overlayKey = await s3Storage.uploadImage(overlayBuffer, 'image/png', 'overlays');
        overlayUrl = s3Storage.getPublicUrl(overlayKey);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
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
      }),
    };
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * GET /issues - List issues with filters
 */
async function handleListIssues(event: RequestEvent) {
  try {
    const issuesTableName = getResourceValue('IssuesTable');
    const issueStore = new DynamoDBIssueStore(issuesTableName);

    // Parse query parameters from Lambda event
    const params = event.queryStringParameters ?? {};
    const siteId = params.siteId ?? (params.status ? undefined : DEFAULT_SITE_ID);
    const statusParam = params.status;
    const status = (statusParam as 'open' | 'assigned' | 'in-progress' | 'pending-verification' | 'resolved' | 'reopened' | 'closed' | undefined) ?? undefined;
    const zone = params.zone ?? undefined;

    const issues = await issueStore.list({ siteId, status, zone });
    const s3Storage = new S3Storage({ bucketName: getResourceValue('ImagesBucket') });
    const sign = (url?: string) => presignIfOwned(s3Storage, getResourceValue('ImagesBucket'), url);
    const signed = await Promise.all(
      issues.map(async (issue: Issue) => ({
        imageUrl: await sign(issue.imageUrl),
        verificationImages: issue.verificationImages
          ? await Promise.all(issue.verificationImages.map(async (u) => (await sign(u)) ?? u))
          : undefined,
      }))
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        issues: issues.map((issue: Issue, i: number) => ({
          id: issue.id,
          title: issue.title,
          category: issue.category,
          riskBand: issue.riskAssessment.riskBand,
          riskScore: issue.riskAssessment.riskScore,
          likelihood: issue.riskAssessment.likelihood,
          impact: issue.riskAssessment.impact,
          zone: issue.zone,
          status: issue.status,
          assignedTo: issue.assignedTo,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          resolvedAt: issue.resolvedAt,
          imageUrl: signed[i]?.imageUrl,
          evidenceBoxes: issue.evidenceBoxes,
          auditTrail: issue.auditTrail,
          verificationImages: signed[i]?.verificationImages,
        })),
        count: issues.length,
      }),
    };
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * POST /issues/{id}/verify - Verify fix with after image
 */
async function handleVerifyFix(event: RequestEvent) {
  try {
    if (!event.body) {
      return errorResponse(400, 'Request body required');
    }

    // Lambda Function URLs do not populate pathParameters; parse from the path.
    const issueId =
      event.pathParameters?.id ??
      decodeURIComponent(event.requestContext.http.path.split('/')[2] ?? '');
    if (!issueId) {
      return errorResponse(400, 'Issue ID required in path');
    }

    const body = JSON.parse(event.body) as {
      afterImage: string;
      provider?: 'meta' | 'baseten';
      returnOverlay?: boolean;
    };

    if (!body.afterImage) {
      return errorResponse(400, 'afterImage field required');
    }

    const afterImageBuffer = decodeImageData(body.afterImage);
    const provider = body.provider ?? 'meta';

    // Get resources
    const metaApiKey = getResourceValue('MetaApiKey');
    const basetenApiKey = getResourceValue('BasetenApiKey');
    const issuesTableName = getResourceValue('IssuesTable');
    const imagesBucketName = getResourceValue('ImagesBucket');

    const issueStore = new DynamoDBIssueStore(issuesTableName);

    // Get issue to determine rule pack
    const issue = await issueStore.get(issueId);
    if (!issue) {
      return errorResponse(404, 'Issue not found');
    }

    // Upload after image to S3
    const s3Storage = new S3Storage({ bucketName: imagesBucketName });
    const afterImageKey = await s3Storage.uploadImage(afterImageBuffer, 'image/jpeg', 'verifications');
    const afterImageUrl = s3Storage.getPublicUrl(afterImageKey);

    // Recreate pipeline (we need to infer the rule pack - use construction as default)
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

    const verification = await agent.verifyFix(
      issueId,
      afterImageBuffer,
      afterImageUrl
    );

    // Render overlay for after image
    let overlayUrl: string | undefined;
    // Re-running detection doubles latency; only do it when explicitly asked.
    const afterFindings = body.returnOverlay === true ? await pipeline.detect(afterImageBuffer) : [];
    if (afterFindings.length > 0) {
      const boxes = afterFindings.flatMap(f => f.evidenceBoxes);
      const labels = afterFindings.flatMap(f => 
        f.evidenceBoxes.map(() => f.rule.title)
      );
      
      if (boxes.length > 0) {
        const overlayBuffer = await renderDetectionBoxes(afterImageBuffer, boxes, labels);
        const overlayKey = await s3Storage.uploadImage(overlayBuffer, 'image/png', 'overlays');
        overlayUrl = s3Storage.getPublicUrl(overlayKey);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        ...verification,
        afterImageUrl,
        overlayUrl,
      }),
    };
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * POST /reports/voice - Transcribe voice report and create issue
 */
async function handleVoiceReport(event: RequestEvent) {
  try {
    if (!event.body) {
      return errorResponse(400, 'Request body required');
    }

    const body = JSON.parse(event.body) as {
      audio: string;
      siteId?: string;
      zone?: string;
    };

    if (!body.audio) {
      return errorResponse(400, 'audio field required (base64)');
    }

    const audioBuffer = Buffer.from(body.audio, 'base64');
    const siteId = body.siteId ?? 'default-site';
    const zone = body.zone ?? 'site-main';

    const metaApiKey = getResourceValue('MetaApiKey');

    const transcriber = new MuseVoiceTranscribe({
      baseURL: 'https://api.meta.ai/v1',
      apiKey: metaApiKey,
      model: 'muse-voice-transcribe-1.0',
    });

    const transcription = await transcriber.transcribe(audioBuffer);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        transcription: transcription.text,
        siteId,
        zone,
        message: 'Voice report received. Manual issue creation required.',
      }),
    };
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Helper: Decode image data (base64 or data URL)
 */
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

/**
 * Helper: Get resource value
 */
function getResourceValue(key: string): string {
  const resource = (Resource as unknown as Record<string, { value?: string; name?: string }>)[key];
  return resource?.value ?? resource?.name ?? '';
}

/**
 * Helper: Create providers
 */
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

/**
 * Helper: Error response
 */
function errorResponse(statusCode: number, message: string) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Helper: turn a URL/key for an object in our private bucket into a presigned GET URL.
 */
async function presignIfOwned(
  s3Storage: S3Storage,
  bucketName: string,
  url?: string
): Promise<string | undefined> {
  if (!url || !bucketName) return url;
  try {
    let key: string | undefined;
    if (!url.startsWith('http')) {
      key = url;
    } else {
      const u = new URL(url);
      if (u.hostname.startsWith(`${bucketName}.s3`)) key = decodeURIComponent(u.pathname.slice(1));
    }
    return key ? await s3Storage.getPresignedUrl(key, 6 * 3600) : url;
  } catch {
    return url;
  }
}
