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

    // API Lambda function
    const api = new sst.aws.Function('Api', {
      handler: 'infra/api.handler',
      url: true,
      link: [basetenApiKey, metaApiKey],
      environment: {
        NODE_ENV: 'production',
      },
    });

    return {
      api: api.url,
    };
  },
});
