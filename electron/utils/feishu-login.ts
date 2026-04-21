/**
 * Feishu / Lark QR Code Login (Device Flow)
 *
 * Implements the Feishu/Lark OAuth v1 app-registration device flow.
 * Based on: https://github.com/openakita/openakita/blob/04b2e204369d90597da9613417224ad33c3d8ea4/src/openakita/setup/feishu_onboard.py
 * And: @larksuite/openclaw-lark-tools bind-agent.js
 *
 * Flow:
 *  1. POST action=begin → get device_code + verification_uri_complete
 *  2. POST action=poll  (repeat) → wait for user to scan & authorize
 *  3. On success: emit 'success' with { appId, appSecret, domain }
 */

import { EventEmitter } from 'events';
import https from 'node:https';
import { renderQrPngBase64 } from './qr-render';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEISHU_ACCOUNTS_BASE = 'https://accounts.feishu.cn';
const LARK_ACCOUNTS_BASE   = 'https://accounts.larksuite.com';
const DEVICE_FLOW_PATH     = '/oauth/v1/app/registration';

export type FeishuDomain = 'feishu' | 'lark';

export interface FeishuQrLoginResult {
  appId: string;
  appSecret: string;
  domain: FeishuDomain;
  userOpenId?: string;
}

// Error codes returned by the polling endpoint
const PENDING_CODES = new Set(['authorization_pending', 'slow_down']);

// ---------------------------------------------------------------------------
// HTTP helper using native Node.js https module
// ---------------------------------------------------------------------------

interface HttpResponse {
  data: Record<string, unknown>;
}

async function postForm(baseUrl: string, path: string, params: Record<string, string>): Promise<HttpResponse> {
  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body).toString(),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          resolve({ data: JSON.parse(data) });
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// FeishuLoginManager
// ---------------------------------------------------------------------------

export class FeishuLoginManager extends EventEmitter {
  private active = false;
  private domain: FeishuDomain = 'feishu';
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private deviceCode: string | null = null;

  private get baseUrl(): string {
    return this.domain === 'feishu' ? FEISHU_ACCOUNTS_BASE : LARK_ACCOUNTS_BASE;
  }

  /** Start the QR login flow for the given domain (feishu or lark). */
  async start(domain: FeishuDomain = 'feishu'): Promise<void> {
    if (this.active) {
      await this.stop();
    }

    this.domain = domain;
    this.active = true;
    this.deviceCode = null;

    try {
      // Step 1: begin — get device_code and verification_uri
      // Note: Reference implementation does NOT call init first
      const beginResult = await postForm(this.baseUrl, DEVICE_FLOW_PATH, {
        action: 'begin',
        archetype: 'PersonalAgent',
        auth_method: 'client_secret',
        request_user_info: 'open_id',
      });

      if (!this.active) return;

      // Prefer verification_uri_complete as it includes user_code
      const deviceCode = beginResult.data['device_code'] as string | undefined;
      const verificationUri = (beginResult.data['verification_uri_complete'] ||
                               beginResult.data['verification_uri'] ||
                               beginResult.data['qr_url']) as string | undefined;
      const interval = (beginResult.data['interval'] as number) || 5;
      const expireIn = (beginResult.data['expire_in'] as number) || 600;
      const userCode = beginResult.data['user_code'] as string | undefined;

      if (!deviceCode || !verificationUri) {
        throw new Error(
          `Begin failed: ${JSON.stringify(beginResult.data)}`
        );
      }

      this.deviceCode = deviceCode;
      console.log('[FeishuLogin] device_code:', deviceCode);
      console.log('[FeishuLogin] user_code:', userCode);
      console.log('[FeishuLogin] verification_uri:', verificationUri);

      // Generate PNG QR code and emit for the UI to display
      let qrBase64: string | null = null;
      try {
        qrBase64 = await renderQrPngBase64(verificationUri);
      } catch (qrErr) {
        console.warn('[FeishuLogin] Could not render QR PNG, falling back to URL', qrErr);
      }
      this.emit('qr', { url: verificationUri, qr: qrBase64, domain, userCode });

      // Step 2: poll until done
      const maxAttempts = Math.ceil(expireIn / interval) + 10;
      this.schedulePoll(deviceCode, interval * 1000, 0, maxAttempts);
    } catch (error) {
      if (this.active) {
        this.active = false;
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[FeishuLogin] Error:', msg);
        this.emit('error', msg);
      }
    }
  }

  private schedulePoll(
    deviceCode: string,
    intervalMs: number,
    attempt: number,
    maxAttempts: number,
  ): void {
    if (!this.active) return;
    if (attempt >= maxAttempts) {
      this.active = false;
      this.emit('error', 'QR code login timed out. Please try again.');
      return;
    }

    this.pollTimer = setTimeout(async () => {
      if (!this.active) return;
      try {
        const result = await postForm(this.baseUrl, DEVICE_FLOW_PATH, {
          action: 'poll',
          device_code: deviceCode,
        });

        if (!this.active) return;

        const error = result.data['error'] as string | undefined;

        if (error) {
          if (PENDING_CODES.has(error)) {
            // Still waiting — try again, slow_down increases interval by 5s
            const nextInterval = error === 'slow_down' ? intervalMs + 5000 : intervalMs;
            if (error === 'slow_down') {
              console.log('[FeishuLogin] slow_down, increasing interval to', nextInterval / 1000, 's');
            }
            this.schedulePoll(deviceCode, nextInterval, attempt + 1, maxAttempts);
          } else if (error === 'expired_token') {
            this.active = false;
            this.emit('error', 'QR code expired. Please click "Refresh" to try again.');
          } else if (error === 'access_denied') {
            this.active = false;
            this.emit('error', 'Authorization was denied by the user.');
          } else {
            this.active = false;
            this.emit('error', `Authorization failed: ${error}`);
          }
          return;
        }

        // Success — map response fields to our result shape
        const clientId     = (result.data['client_id'] || result.data['app_id']) as string | undefined;
        const clientSecret = (result.data['client_secret'] || result.data['app_secret']) as string | undefined;

        if (!clientId || !clientSecret) {
          this.active = false;
          this.emit('error', `Unexpected response (missing credentials): ${JSON.stringify(result.data)}`);
          return;
        }

        // Extract user info
        const userInfo   = result.data['user_info'] as Record<string, unknown> | undefined;
        const userOpenId = userInfo?.['open_id'] as string | undefined;

        // Detect domain from tenant brand if available
        const brand = ((userInfo?.['brand'] || userInfo?.['tenant_brand']) as string | undefined)?.toLowerCase();
        const resolvedDomain: FeishuDomain =
          brand === 'lark' ? 'lark' : this.domain;

        console.log('[FeishuLogin] Success! appId:', clientId);
        console.log('[FeishuLogin] userOpenId:', userOpenId);
        console.log('[FeishuLogin] domain:', resolvedDomain);

        this.active = false;
        this.deviceCode = null;
        const loginResult: FeishuQrLoginResult = {
          appId: clientId,
          appSecret: clientSecret,
          domain: resolvedDomain,
          userOpenId,
        };
        this.emit('success', loginResult);
      } catch (err) {
        console.warn('[FeishuLogin] Poll error:', err);
        if (this.active) {
          // Retry on network errors
          this.schedulePoll(deviceCode, intervalMs, attempt + 1, maxAttempts);
        }
      }
    }, intervalMs);
  }

  async stop(): Promise<void> {
    this.active = false;
    this.deviceCode = null;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export const feishuLoginManager = new FeishuLoginManager();
