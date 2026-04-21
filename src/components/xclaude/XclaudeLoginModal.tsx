/**
 * XclaudeLoginModal
 * Shown on startup when no JWT token is found in useXclaudeStore.
 * Embeds the Xclaude login page in an iframe and listens for the token
 * via postMessage, then closes itself.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settings';
import { useXclaudeStore } from '@/stores/xclaude';

interface XclaudeLoginModalProps {
  onSuccess: () => void;
}

export function XclaudeLoginModal({ onSuccess }: XclaudeLoginModalProps) {
  const { t } = useTranslation('common');
  const xclaudeServerUrl = useSettingsStore((s) => s.xclaudeServerUrl);
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const setJwtToken = useXclaudeStore((s) => s.setJwtToken);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const effectiveTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  const xclaudeLang = language?.startsWith('zh') ? 'zh' : 'en';
  const baseUrl = xclaudeServerUrl.replace(/\/$/, '');
  const src = `${baseUrl}/login?hide_all_bar=true&theme=${effectiveTheme}&lang=${xclaudeLang}`;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const expectedOrigin = new URL(baseUrl).origin;
        if (event.origin !== expectedOrigin) return;
      } catch {
        return;
      }
      if (event.data?.type === 'XCLAUDE_TOKEN' && typeof event.data.token === 'string') {
        setJwtToken(event.data.token);
        onSuccess();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [baseUrl, setJwtToken, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col w-[480px] max-w-[95vw] h-[600px] max-h-[90vh] rounded-xl overflow-hidden shadow-2xl border border-border bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-sm font-medium text-foreground">
            {t('xclaude.loginTitle')}
          </span>
          <span className="text-xs text-muted-foreground">{baseUrl}</span>
        </div>
        <iframe
          ref={iframeRef}
          src={src}
          className="flex-1 w-full border-0"
          title="Xclaude Login"
        />
      </div>
    </div>
  );
}
