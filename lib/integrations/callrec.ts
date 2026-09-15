export type CallRecConfig = {
  baseUrl: string;
  jwtToken?: string;
};

export type CallRecRequest = {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

export class CallRecApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'CallRecApiError';
    this.status = status;
    this.details = details;
  }
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

export function getCallRecServerConfig(): CallRecConfig | null {
  const baseUrl = process.env.CALLREC_API_URL;
  if (!baseUrl) return null;

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    jwtToken: process.env.CALLREC_JWT_TOKEN,
  };
}

/**
 * Server-only CallRec REST adapter.
 *
 * The public CallRec documentation confirms REST API + JWT authentication,
 * but the generated API reference is not machine-readable from our build
 * environment. Endpoint paths therefore stay outside the browser bundle and
 * are deliberately supplied by the integration layer when the API contract
 * is confirmed.
 */
export async function callRecRequest<T>(
  request: CallRecRequest,
  config = getCallRecServerConfig(),
): Promise<T> {
  if (!config) throw new Error('CallRec API is not configured');

  const path = request.path.startsWith('/') ? request.path : `/${request.path}`;
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: request.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(config.jwtToken ? { Authorization: `Bearer ${config.jwtToken}` } : {}),
    },
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text();

  if (!response.ok) {
    throw new CallRecApiError(`CallRec API request failed: ${response.status}`, response.status, payload);
  }

  return payload as T;
}

export function isCallRecConfigured() {
  return Boolean(process.env.CALLREC_API_URL && process.env.CALLREC_JWT_TOKEN);
}
