/**
 * SiteSentinel API Handler
 *
 * Lambda function for hazard detection API endpoints.
 * Future endpoints:
 * - POST /analyze - Analyze image for hazards
 * - GET /alerts - List active alerts
 * - POST /alerts/:id/verify - Verify hazard fix
 */

import { Resource } from 'sst';

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
          baseten: !!(Resource as unknown as Record<string, { value?: string }>)
            .BasetenApiKey?.value,
          meta: !!(
            Resource as unknown as Record<string, { value?: string }>
          ).MetaApiKey?.value,
        },
      }),
    };
  }

  // Placeholder for future endpoints
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Not Found',
      message: 'Endpoint not implemented yet',
      availableEndpoints: ['/health'],
    }),
  };
}
