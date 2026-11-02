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

interface RequestEvent {
  requestContext: { http: { method: string; path: string } };
  body?: string;
  pathParameters?: Record<string, string>;
}

export async function handler(event: RequestEvent) {
  const { method, path } = event.requestContext.http;

  // Health check
  if (method === 'GET' && path === '/health') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'healthy',
        service: 'SiteSentinel Agent API',
        timestamp: new Date().toISOString(),
        version: '3.0.0-agent-loop',
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
    headers: { 'Content-Type': 'application/json' },
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
    const siteId = body.siteId ?? 'default-site';
    const provider = body.provider ?? 'meta';

    // Get API keys
    const metaApiKey = getResourceValue('MetaApiKey');
    const basetenApiKey = getResourceValue('BasetenApiKey');
    const issuesTableName = getResourceValue('IssuesTable');

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
      `s3://images/${Date.now()}.jpg`
    );

    // Optionally render overlay
    // TODO: Update overlay renderer to work with new HazardFinding type
    let overlayBase64: string | undefined;
    // if (body.returnOverlay && result.issues.length > 0) {
    //   const findings = ...
    //   const overlayBuffer = await renderOverlay(imageBuffer, findings);
    //   overlayBase64 = overlayBuffer.toString('base64');
    // }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
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
        })),
        auditTrail: result.auditTrail,
        overlay: overlayBase64
          ? `data:image/png;base64,${overlayBase64}`
          : undefined,
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

    const url = new URL(
      event.requestContext.http.path,
      'https://api.sitesentinel.com'
    );
    const siteId = url.searchParams.get('siteId') ?? undefined;
    const statusParam = url.searchParams.get('status');
    const status = statusParam as 'open' | 'assigned' | 'in-progress' | 'pending-verification' | 'resolved' | 'reopened' | 'closed' | null;
    const zone = url.searchParams.get('zone') ?? undefined;

    const issues = await issueStore.list({ siteId, status, zone });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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

    const issueId = event.pathParameters?.id;
    if (!issueId) {
      return errorResponse(400, 'Issue ID required in path');
    }

    const body = JSON.parse(event.body) as {
      afterImage: string;
      provider?: 'meta' | 'baseten';
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

    const issueStore = new DynamoDBIssueStore(issuesTableName);

    // Get issue to determine rule pack
    const issue = await issueStore.get(issueId);
    if (!issue) {
      return errorResponse(404, 'Issue not found');
    }

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
      `s3://images/verify-${Date.now()}.jpg`
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verification),
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
      headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}
