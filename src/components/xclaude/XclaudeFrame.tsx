/**
 * XclaudeFrame Component
 * Embeds an Xclaude page in an iframe, handles JWT token injection via postMessage,
 * and listens for token updates from Xclaude.
 */
import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/settings';
import { useXclaudeStore } from '@/stores/xclaude';

interface XclaudeFrameProps {
  /** Xclaude page path, e.g. "/dashboard" */
  path: string;
}

export function XclaudeFrame({ path }: XclaudeFrameProps) {
  const xclaudeServerUrl = useSettingsStore((s) => s.xclaudeServerUrl);
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const jwtToken = useXclaudeStore((s) => s.jwtToken);
  const setJwtToken = useXclaudeStore((s) => s.setJwtToken);
  const clearJwtToken = useXclaudeStore((s) => s.clearJwtToken);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  // Bump this key to force iframe reload (e.g. after login)
  const [reloadKey, setReloadKey] = useState(0);
  const prevTokenRef = useRef<string | null>(jwtToken);

  // Reload iframe when token transitions from null → value (login success)
  useEffect(() => {
    if (!prevTokenRef.current && jwtToken) {
      setReloadKey((k) => k + 1);
    }
    prevTokenRef.current = jwtToken;
  }, [jwtToken]);

  // Resolve effective theme (system → actual)
  const effectiveTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  // Map ClawX language to Xclaude locale param
  const xclaudeLang = language?.startsWith('zh') ? 'zh' : 'en';

  const baseUrl = xclaudeServerUrl.replace(/\/$/, '');
  const src = `${baseUrl}${path}?hide_all_bar=true&theme=${effectiveTheme}&lang=${xclaudeLang}`;

  // Reset loading state whenever the src URL changes (theme switch, page navigation)
  useEffect(() => {
    setIframeLoaded(false);
  }, [src]);

  // Inject stored JWT token into iframe after it loads
  useEffect(() => {
    if (!iframeLoaded || !jwtToken || !iframeRef.current?.contentWindow) return;
    try {
      const targetOrigin = new URL(baseUrl).origin;
      iframeRef.current.contentWindow.postMessage(
        { type: 'XCLAUDE_SET_TOKEN', token: jwtToken },
        targetOrigin
      );
    } catch {
      // Invalid URL, skip
    }
  }, [iframeLoaded, jwtToken, baseUrl]);

  // Push language changes to the iframe via postMessage
  useEffect(() => {
    if (!iframeLoaded || !iframeRef.current?.contentWindow) return;
    try {
      const targetOrigin = new URL(baseUrl).origin;
      iframeRef.current.contentWindow.postMessage(
        { type: 'XCLAUDE_SET_LANG', lang: xclaudeLang },
        targetOrigin
      );
    } catch {
      // Invalid URL, skip
    }
  }, [iframeLoaded, xclaudeLang, baseUrl]);

  // Listen for JWT token sent from Xclaude iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Only accept messages from the configured Xclaude server origin
      try {
        const expectedOrigin = new URL(baseUrl).origin;
        if (event.origin !== expectedOrigin) return;
      } catch {
        return;
      }
      if (event.data?.type === 'XCLAUDE_TOKEN' && typeof event.data.token === 'string') {
        setJwtToken(event.data.token);
      }
      if (event.data?.type === 'XCLAUDE_LOGOUT') {
        clearJwtToken();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [baseUrl, setJwtToken, clearJwtToken]);

  if (!xclaudeServerUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <p className="text-sm">Xclaude server URL not configured.</p>
        <p className="text-xs">Go to Settings to set the Xclaude server URL.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!iframeLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
      <iframe
        key={reloadKey}
        ref={iframeRef}
        src={src}
        className="w-full h-full border-0"
        onLoad={() => setIframeLoaded(true)}
        allow="clipboard-read; clipboard-write"
        title={path}
      />
    </div>
  );
}
