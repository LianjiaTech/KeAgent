/**
 * Xclaude Provider Account Sync
 * Fetches (or creates) the user's "OpenClaw" API key from Xclaude and
 * creates/updates one ProviderAccount per model in VITE_DEFAULT_MODELS,
 * each pre-configured to use that model with the Xclaude backend.
 * Uses IPC to make requests from the main process, bypassing renderer CORS.
 */
import { hostApiFetch } from '@/lib/host-api';
import { invokeIpc } from '@/lib/api-client';
import type { ProviderAccount } from '@/lib/providers';

const OPENCLAW_KEY_NAME = 'OpenClaw-Default-Key';

// Read model list from env, fallback to defaults
export const XCLAUDE_MODELS: string[] = (() => {
  const raw = import.meta.env.VITE_DEFAULT_MODELS as string | undefined;
  if (raw) {
    const parsed = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
    if (parsed.length > 0) return parsed;
  }
  return ['claude-sonnet-4-6', 'claude-opus-4-6'];
})();

/** Deterministic account ID for a given Xclaude model */
export function xclaudeAccountId(model: string): string {
  return `xclaude-${model.replace(/[^a-z0-9-]/gi, '-')}`;
}

interface XclaudeFetchData {
  status: number;
  ok: boolean;
  json?: unknown;
  text?: string;
}

interface XclaudeFetchResult {
  ok: boolean;
  data?: XclaudeFetchData;
  error?: { message: string };
}

async function xclaudeFetch(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<unknown> {
  const result = await invokeIpc<XclaudeFetchResult>('xclaude:fetch', {
    url,
    method: options?.method ?? 'GET',
    headers: options?.headers,
    body: options?.body,
  });
  if (!result?.ok || !result.data?.ok) {
    throw new Error(result?.error?.message ?? `xclaude fetch failed: ${url}`);
  }
  return result.data.json;
}

/**
 * Validates a JWT token by calling /api/v1/auth/me.
 * Returns true if the token is valid, false if expired/invalid (401/403).
 * Throws on network errors so callers can distinguish.
 */
export async function validateXclaudeToken(jwtToken: string, xclaudeServerUrl: string): Promise<boolean> {
  const baseUrl = xclaudeServerUrl.replace(/\/$/, '');
  const result = await invokeIpc<XclaudeFetchResult>('xclaude:fetch', {
    url: `${baseUrl}/api/v1/auth/me`,
    method: 'GET',
    headers: { Authorization: `Bearer ${jwtToken}` },
  });
  console.log('[xclaude] validateToken result:', JSON.stringify(result));
  if (!result?.ok) throw new Error(result?.error?.message ?? 'xclaude:fetch failed');
  const valid = result.data?.status !== 401 && result.data?.status !== 403;
  console.log('[xclaude] token valid:', valid, 'status:', result.data?.status);
  return valid;
}

interface XclaudeApiKey {
  id: number;
  key: string;
  name: string;
  status: string;
}

interface XclaudeApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface XclaudePaginatedKeys {
  items: XclaudeApiKey[];
  total: number;
}

/**
 * Fetches or creates the user's "OpenClaw" API key from Xclaude,
 * then creates or updates one ProviderAccount per model in XCLAUDE_MODELS.
 * The first model's account is set as default.
 * Returns the API key string, or null on failure.
 */
export async function syncXclaudeProviderAccount(
  jwtToken: string,
  xclaudeServerUrl: string,
): Promise<string | null> {
  const baseUrl = xclaudeServerUrl.replace(/\/$/, '');
  const authHeaders = { Authorization: `Bearer ${jwtToken}` };

  // 1. Fetch user's API keys
  const keysResp = await xclaudeFetch(
    `${baseUrl}/api/v1/keys?page=1&page_size=50`,
    { headers: authHeaders },
  ) as XclaudeApiResponse<XclaudePaginatedKeys>;

  const items = keysResp.data?.items ?? [];

  // 2. Find existing OpenClaw key or create one
  let openClawKey = items.find((k) => k.name.includes(OPENCLAW_KEY_NAME));

  if (!openClawKey) {
    const createResp = await xclaudeFetch(
      `${baseUrl}/api/v1/keys`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: OPENCLAW_KEY_NAME, group_id: 1 }),
      },
    ) as XclaudeApiResponse<XclaudeApiKey>;
    openClawKey = createResp.data;
  }

  if (!openClawKey?.key) return null;

  const apiKey = openClawKey.key;
  const now = new Date().toISOString();

  // 3. Create or update one account per model
  let firstAccountId: string | undefined;

  for (const model of XCLAUDE_MODELS) {
    const id = xclaudeAccountId(model);

    let existing: ProviderAccount | null = null;
    try {
      existing = await hostApiFetch<ProviderAccount>(`/api/provider-accounts/${id}`);
    } catch {
      // Not found — will create
    }

    const account: ProviderAccount = {
      id,
      vendorId: 'xclaude',
      label: `Xclaude (${model})`,
      authMode: 'api_key',
      baseUrl,
      apiProtocol: 'anthropic-messages',
      model,
      enabled: true,
      isDefault: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      await hostApiFetch(`/api/provider-accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          updates: {
            baseUrl,
            apiProtocol: 'anthropic-messages',
            model,
            enabled: true,
            updatedAt: now,
          },
          apiKey,
        }),
      });
    } else {
      await hostApiFetch('/api/provider-accounts', {
        method: 'POST',
        body: JSON.stringify({ account, apiKey }),
      });
    }

    if (!firstAccountId) {
      firstAccountId = id;
    }
  }

  // 4. Set the first model's account as default
  if (firstAccountId) {
    await hostApiFetch('/api/provider-accounts/default', {
      method: 'PUT',
      body: JSON.stringify({ accountId: firstAccountId }),
    });
  }

  return apiKey;
}
