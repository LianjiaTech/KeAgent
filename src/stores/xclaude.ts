/**
 * Xclaude Integration Store
 * Manages JWT token and active API key received from Xclaude
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface XclaudeState {
  // JWT token received from Xclaude via postMessage
  jwtToken: string | null;
  // Active API key synced from Xclaude (used for provider account)
  apiKey: string | null;
  setJwtToken: (token: string | null) => void;
  setApiKey: (key: string | null) => void;
  clearJwtToken: () => void;
}

export const useXclaudeStore = create<XclaudeState>()(
  persist(
    (set) => ({
      jwtToken: null,
      apiKey: null,
      setJwtToken: (token) => set({ jwtToken: token }),
      setApiKey: (key) => set({ apiKey: key }),
      clearJwtToken: () => set({ jwtToken: null, apiKey: null }),
    }),
    {
      name: 'clawx-xclaude',
    }
  )
);
