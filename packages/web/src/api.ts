import type {
  Issue,
  InspectRequest,
  InspectResponse,
  VerifyRequest,
  VerifyResponse,
  VoiceReportRequest,
  VoiceReportResponse,
} from './types';

// Same-origin /api in production. CloudFront attaches the API key; the browser never sees it.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async inspect(request: InspectRequest): Promise<InspectResponse> {
    const response = await fetch(`${this.baseUrl}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error ?? 'Inspection failed');
    }

    return response.json() as Promise<InspectResponse>;
  }

  async listIssues(filters?: {
    siteId?: string;
    status?: string;
    zone?: string;
  }): Promise<{ issues: Issue[]; count: number }> {
    const params = new URLSearchParams();
    if (filters?.siteId) params.append('siteId', filters.siteId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.zone) params.append('zone', filters.zone);

    const url = `${this.baseUrl}/issues${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(error.error ?? 'Failed to fetch issues');
    }

    return response.json() as Promise<{ issues: Issue[]; count: number }>;
  }

  async verifyFix(issueId: string, request: VerifyRequest): Promise<VerifyResponse> {
    // Verification runs the full model pipeline; don't let the request hang forever.
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); }, 150_000);
    const response = await fetch(`${this.baseUrl}/issues/${issueId}/verify`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }).finally(() => { clearTimeout(timer); });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(error.error ?? `Verification failed (${String(response.status)})`);
    }

    return response.json() as Promise<VerifyResponse>;
  }

  async transcribeVoice(request: VoiceReportRequest): Promise<VoiceReportResponse> {
    const response = await fetch(`${this.baseUrl}/reports/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error ?? 'Transcription failed');
    }

    return response.json() as Promise<VoiceReportResponse>;
  }
}

export const SITE_ID = 'demo-site';

export const apiClient = new ApiClient(API_URL);
