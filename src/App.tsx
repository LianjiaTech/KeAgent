/**
 * Root Application Component
 * Handles routing and global providers
 */
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Component, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { MainLayout } from './components/layout/MainLayout';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Models } from './pages/Models';
import { Chat } from './pages/Chat';
import { Agents } from './pages/Agents';
import { Channels } from './pages/Channels';
import { Skills } from './pages/Skills';
import { Cron } from './pages/Cron';
import { Settings } from './pages/Settings';
import { Setup } from './pages/Setup';
import {
  XclaudeDashboard,
  XclaudeApiKeys,
  XclaudeUsage,
  XclaudePurchase,
  XclaudeReferral,
  XclaudeProfile,
} from './pages/Xclaude';
import { XclaudeLoginDialog } from './components/xclaude/XclaudeLoginDialog';
import { useSettingsStore } from './stores/settings';
import { useGatewayStore } from './stores/gateway';
import { useProviderStore } from './stores/providers';
import { useXclaudeStore } from './stores/xclaude';
import { applyGatewayTransportPreference } from './lib/api-client';
import { syncXclaudeProviderAccount, validateXclaudeToken } from './lib/xclaude-sync';


/**
 * Error Boundary to catch and display React rendering errors
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React Error Boundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          color: '#f87171',
          background: '#0f172a',
          minHeight: '100vh',
          fontFamily: 'monospace'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Something went wrong</h1>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            background: '#1e293b',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('common');
  const initSettings = useSettingsStore((state) => state.init);
  const theme = useSettingsStore((state) => state.theme);
  const language = useSettingsStore((state) => state.language);
  const setupComplete = useSettingsStore((state) => state.setupComplete);
  const xclaudeServerUrl = useSettingsStore((state) => state.xclaudeServerUrl);
  const initGateway = useGatewayStore((state) => state.init);
  const jwtToken = useXclaudeStore((state) => state.jwtToken);
  const setApiKey = useXclaudeStore((state) => state.setApiKey);

  // initSettings is async; track when it resolves so we can act on final state
  const [settingsReady, setSettingsReady] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  // On first install (!setupComplete): gate the setup redirect behind login.
  // Initialize to true if a token already exists so returning users skip the
  // pre-setup login and go straight to the wizard.
  const [loginBeforeSetupDone, setLoginBeforeSetupDone] = useState(!!jwtToken);

  // When token is cleared (logout from Xclaude iframe), show login dialog
  useEffect(() => {
    if (settingsReady && setupComplete && !jwtToken) {
      setShowLoginDialog(true);
    }
  }, [jwtToken, settingsReady, setupComplete]);

  // Before setup: show login dialog once settings are ready and user has no token
  useEffect(() => {
    if (settingsReady && !setupComplete && !loginBeforeSetupDone) {
      setShowLoginDialog(true);
    }
  }, [settingsReady, setupComplete, loginBeforeSetupDone]);
  const initProviders = useProviderStore((state) => state.init);

  useEffect(() => {
    initSettings().finally(() => setSettingsReady(true));
  }, [initSettings]);

  // Sync i18n language with persisted settings on mount
  useEffect(() => {
    if (language && language !== i18n.language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  // Initialize Gateway connection on mount
  useEffect(() => {
    initGateway();
  }, [initGateway]);

  // Initialize provider snapshot on mount
  useEffect(() => {
    initProviders();
  }, [initProviders]);

  // Initialize provider snapshot on mount
  useEffect(() => {
    initProviders();
  }, [initProviders]);

  // Redirect to setup wizard if not complete — but only after login is done
  useEffect(() => {
    if (!setupComplete && loginBeforeSetupDone && !location.pathname.startsWith('/setup')) {
      navigate('/setup');
    }
  }, [setupComplete, loginBeforeSetupDone, location.pathname, navigate]);

  // After settings loaded: validate token → show login dialog if missing/expired; sync if valid
  useEffect(() => {
    console.log('[xclaude] startup check — settingsReady:', settingsReady, 'setupComplete:', setupComplete, 'hasToken:', !!jwtToken);
    if (!settingsReady) return;
    if (!setupComplete) return;

    if (!jwtToken) {
      setShowLoginDialog(true);
      return;
    }

    validateXclaudeToken(jwtToken, xclaudeServerUrl)
      .then((valid) => {
        if (!valid) {
          setShowLoginDialog(true);
          return;
        }
        const toastId = toast.loading(t('xclaude.syncingAccount'));
        syncXclaudeProviderAccount(jwtToken, xclaudeServerUrl)
          .then((apiKey) => {
            if (apiKey) setApiKey(apiKey);
            toast.success(t('xclaude.syncSuccess'), { id: toastId });
          })
          .catch(() => {
            toast.dismiss(toastId);
            setShowLoginDialog(true);
          });
      })
      .catch(() => {
        // Network error — still try to sync, don't force logout
        const toastId = toast.loading(t('xclaude.syncingAccount'));
        syncXclaudeProviderAccount(jwtToken, xclaudeServerUrl)
          .then((apiKey) => {
            if (apiKey) setApiKey(apiKey);
            toast.success(t('xclaude.syncSuccess'), { id: toastId });
          })
          .catch(() => toast.dismiss(toastId));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsReady, setupComplete]);

  // Listen for navigation events from main process
  useEffect(() => {
    const handleNavigate = (...args: unknown[]) => {
      const path = args[0];
      if (typeof path === 'string') {
        navigate(path);
      }
    };

    const unsubscribe = window.electron.ipcRenderer.on('navigate', handleNavigate);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [navigate]);

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    applyGatewayTransportPreference();
  }, []);

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        <Routes>
          {/* Setup wizard (shown on first launch) */}
          <Route path="/setup/*" element={<Setup />} />

          {/* Main application routes */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Chat />} />
            <Route path="/models" element={<Models />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/cron" element={<Cron />} />
            <Route path="/settings/*" element={<Settings />} />
            {/* Xclaude integration pages */}
            <Route path="/xclaude/dashboard" element={<XclaudeDashboard />} />
            <Route path="/xclaude/keys" element={<XclaudeApiKeys />} />
            <Route path="/xclaude/usage" element={<XclaudeUsage />} />
            <Route path="/xclaude/purchase" element={<XclaudePurchase />} />
            <Route path="/xclaude/referral" element={<XclaudeReferral />} />
            <Route path="/xclaude/profile" element={<XclaudeProfile />} />
          </Route>
        </Routes>

        {/* Xclaude login dialog — shown before setup (first install) or when token expires */}
        {showLoginDialog && (
          <XclaudeLoginDialog
            onClose={() => {
              setShowLoginDialog(false);
              // If setup hasn't been completed yet, unblock the setup redirect
              if (!setupComplete) {
                setLoginBeforeSetupDone(true);
              }
            }}
          />
        )}

        {/* Global toast notifications */}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          style={{ zIndex: 99999 }}
        />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
