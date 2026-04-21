/**
 * XclaudeLoginDialog
 * Modal dialog shown when JWT token is missing or expired.
 * Embeds the Xclaude login/register page in an iframe.
 * Closes automatically on successful login or registration.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settings';
import { useXclaudeStore } from '@/stores/xclaude';
import { syncXclaudeProviderAccount } from '@/lib/xclaude-sync';

interface XclaudeLoginDialogProps {
  onClose: () => void;
}

export function XclaudeLoginDialog({ onClose }: XclaudeLoginDialogProps) {
  const { t } = useTranslation('common');
  const xclaudeServerUrl = useSettingsStore((s) => s.xclaudeServerUrl);
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const setJwtToken = useXclaudeStore((s) => s.setJwtToken);
  const setApiKey = useXclaudeStore((s) => s.setApiKey);
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
          onClose();
        })
        .catch(() => {
          toast.error(t('xclaude.syncFailed'), { id: toastId });
          onClose();
        });
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [baseUrl, xclaudeServerUrl, setJwtToken, setApiKey, onClose, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col w-[520px] max-w-[95vw] h-[640px] max-h-[90vh] rounded-xl overflow-hidden shadow-2xl border border-border bg-background">
        <iframe
          src={src}
          className="flex-1 w-full border-0"
          title="Xclaude Login"
        />
      </div>
    </div>
  );
}
