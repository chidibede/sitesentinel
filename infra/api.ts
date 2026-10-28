/**
 * SiteSentinel API Handler
 *
 * Lambda function for hazard detection API endpoints.
 */

import { Resource } from 'sst';
import { HazardDetectionPipeline } from '@sitesentinel/core';
import { renderOverlay } from '@sitesentinel/core';

export function handler(event: {
  requestContext: { http: { method: string; path: string } };
  body?: string;
}) {
  const { method, path } = event.requestContext.http;

  // Health check endpoint
  if (method === 'GET' && path === '/health') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'healthy',
        service: 'SiteSentinel API',
        timestamp: new Date().toISOString(),
        secrets: {
          baseten: !!(
            Resource as unknown as Record<string, { value?: string }>
          ).BasetenApiKey?.value,
          meta: !!(
            Resource as unknown as Record<string, { value?: string }>
          ).MetaApiKey?.value,
        },
      }),
    };
  }

  // POST /inspect - Run hazard detection
  if (method === 'POST' && path === '/inspect') {
    return handleInspect(event);
  }

  // Not found
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Not Found',
      message: 'Endpoint not implemented yet',
      availableEndpoints: ['/health', 'POST /inspect'],
    }),
  };
}

/**
 * Handle POST /inspect
 */
async function handleInspect(event: { body?: string }) {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Request body required',
        }),
      };
    }

    const body = JSON.parse(event.body) as {
      image: string;
      rulePackId?: string;
      provider?: 'meta' | 'baseten';
      returnOverlay?: boolean;
    };

    if (!body.image) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'image field required (base64 or data URL)',
        }),
      };
    }

    // Normalize to data URL
    let imageDataUrl = body.image;
    if (!imageDataUrl.startsWith('data:')) {
      imageDataUrl = `data:image/jpeg;base64,${imageDataUrl}`;
    }

    // Get API keys from SST secrets
    const metaApiKey = (
      Resource as unknown as Record<string, { value?: string }>
    ).MetaApiKey?.value;
    const basetenApiKey = (
      Resource as unknown as Record<string, { value?: string }>
    ).BasetenApiKey?.value;

    // Initialize pipeline
    const pipeline = new HazardDetectionPipeline({
      metaApiKey,
      basetenApiKey,
    });

    // Run inspection
    const result = await pipeline.inspect(imageDataUrl, {
      rulePackId: body.rulePackId ?? 'construction',
      provider: body.provider ?? 'meta',
      reasoningEffort: 'low',
    });

    // Optionally render overlay
    let overlayBase64: string | undefined;

    if (body.returnOverlay && result.findings.length > 0) {
      // Extract base64 from data URL
      const base64Data = imageDataUrl.split(',')[1];
      if (base64Data) {
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const overlayBuffer = await renderOverlay(imageBuffer, result.findings);
        overlayBase64 = overlayBuffer.toString('base64');
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...result,
        overlay: overlayBase64
          ? `data:image/png;base64,${overlayBase64}`
          : undefined,
      }),
    };
  } catch (error) {
    console.error('Inspection error:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}
