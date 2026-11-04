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
    const apiKey = new sst.Secret('ApiKey');

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

    // API Lambda function. Direct calls still require the x-api-key header.
    const api = new sst.aws.Function('Api', {
      handler: 'infra/api.handler',
      url: true,
      link: [basetenApiKey, metaApiKey, apiKey, issuesTable],
      environment: {
        NODE_ENV: 'production',
      },
      // esbuild on Windows cannot read pnpm directory junctions ("Incorrect function"
      // / unresolved imports). Install these into the Lambda instead of bundling them.
      nodejs: {
        install: [
          'openai',
          'sharp',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/lib-dynamodb',
          'aws4fetch',
        ],
      },
    });

    // Static site on S3 + CloudFront. Browser calls go to /api on this host.
    // CloudFront adds the API key on the way to Lambda, so the key is not in the JS bundle.
    const web = new sst.aws.StaticSite('Web', {
      path: 'packages/web',
      build: {
        command: 'pnpm run build',
        output: 'dist',
      },
      environment: {
        VITE_API_URL: '/api',
      },
      transform: {
        cdn: (args) => {
          args.origins = $util
            .all([args.origins, api.url, apiKey.value])
            .apply(([origins, url, key]) => [
              ...origins,
              {
                originId: 'api',
                domainName: new URL(url).host,
                customHeaders: [{ name: 'x-api-key', value: key }],
                customOriginConfig: {
                  httpPort: 80,
                  httpsPort: 443,
                  originProtocolPolicy: 'https-only',
                  originReadTimeout: 60,
                  originSslProtocols: ['TLSv1.2'],
                },
              },
            ]);
          args.orderedCacheBehaviors = [
            {
              pathPattern: '/api/*',
              targetOriginId: 'api',
              viewerProtocolPolicy: 'redirect-to-https',
              allowedMethods: [
                'GET',
                'HEAD',
                'OPTIONS',
                'PUT',
                'POST',
                'PATCH',
                'DELETE',
              ],
              cachedMethods: ['GET', 'HEAD'],
              compress: true,
              cachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
              originRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac',
            },
          ];
        },
      },
    });

    return {
      api: api.url,
      web: web.url,
      issuesTable: issuesTable.name,
    };
  },
});
