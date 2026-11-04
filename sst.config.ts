/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SiteSentinel Infrastructure
 *
 * SST v3 configuration for AWS deployment:
 * - API Gateway + Lambda for hazard detection endpoints
 * - Secrets management for API keys
 * - Future: DynamoDB for alerts, S3 for images, etc.
 */

export default $config({
  app(input) {
    return {
      name: 'sitesentinel',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
    };
  },
  async run() {
    // Secrets for API keys (set via `sst secret set`)
    const basetenApiKey = new sst.Secret('BasetenApiKey');
    const metaApiKey = new sst.Secret('MetaApiKey');

    // DynamoDB table for issues
    const issuesTable = new sst.aws.Dynamo('IssuesTable', {
      fields: {
        id: 'string',
        siteId: 'string',
        status: 'string',
        createdAt: 'string',
      },
      primaryIndex: { hashKey: 'id' },
      globalIndexes: {
        bySite: { hashKey: 'siteId', rangeKey: 'createdAt' },
        byStatus: { hashKey: 'status', rangeKey: 'createdAt' },
      },
    });

    // S3 bucket for images and overlays
    // Private bucket: the API returns presigned GET URLs for evidence images.
    const imagesBucket = new sst.aws.Bucket('ImagesBucket');

    // API Lambda function
    const api = new sst.aws.Function('Api', {
      handler: 'infra/api.handler',
      // Function URL (no API Gateway 29s cap). CORS is handled in the handler
      // itself, so disable URL-level CORS to avoid duplicate CORS headers.
      url: { cors: false },
      // Inspect/verify call SAM + Muse Spark and take ~20-60s; the SST default
      // of 20s made /inspect return 502 on AWS.
      timeout: '120 seconds',
      memory: '1536 MB',
      link: [basetenApiKey, metaApiKey, issuesTable, imagesBucket],
      environment: {
        NODE_ENV: 'production',
      },
    });

    // Web frontend
    const web = new sst.aws.StaticSite('Web', {
      path: 'packages/web',
      build: {
        command: 'pnpm run build',
        output: 'dist',
      },
      environment: {
        VITE_API_URL: api.url,
      },
    });

    return {
      api: api.url,
      web: web.url,
      issuesTable: issuesTable.name,
      imagesBucket: imagesBucket.name,
    };
  },
});
