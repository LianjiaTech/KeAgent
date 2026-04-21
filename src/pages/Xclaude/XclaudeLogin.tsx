/**
 * XclaudeLogin Page
 * Full-screen Xclaude login/register page.
 * On success, shows a toast and navigates back to the app.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settings';
import { useXclaudeStore } from '@/stores/xclaude';
import { syncXclaudeProviderAccount } from '@/lib/xclaude-sync';

export function XclaudeLogin() {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const xclaudeServerUrl = useSettingsStore((s) => s.xclaudeServerUrl);
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const setJwtToken = useXclaudeStore((s) => s.setJwtToken);
  const setApiKey = useXclaudeStore((s) => s.setApiKey);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const handledRef = useRef(false);

  const effectiveTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  const xclaudeLang = language?.startsWith('zh') ? 'zh' : 'en';
  const baseUrl = xclaudeServerUrl.replace(/\/$/, '');
  const src = `${baseUrl}/login?hide_all_bar=true&theme=${effectiveTheme}&lang=${xclaudeLang}`;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (handledRef.current) return;
      try {
        if (event.origin !== new URL(baseUrl).origin) return;
      } catch {
        return;
      }
      if (event.data?.type !== 'XCLAUDE_TOKEN' || typeof event.data.token !== 'string') return;

      handledRef.current = true;
      const token = event.data.token as string;
      const isNewUser = !!event.data.isNewUser;
      setJwtToken(token);

      const toastId = toast.loading(t('xclaude.syncingAccount'));
      syncXclaudeProviderAccount(token, xclaudeServerUrl)
        .then((apiKey) => {
          if (apiKey) setApiKey(apiKey);
          toast.success(
            isNewUser ? t('xclaude.registerSuccess') : t('xclaude.loginSuccess'),
            { id: toastId },
          );
          navigate('/', { replace: true });
        })
        .catch(() => {
          toast.error(t('xclaude.syncFailed'), { id: toastId });
          navigate('/', { replace: true });
        });
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [baseUrl, xclaudeServerUrl, setJwtToken, setApiKey, navigate, t]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <iframe
        ref={iframeRef}
        src={src}
        className="flex-1 w-full border-0"
        title="Xclaude Login"
      />
    </div>
  );
}
