import { XclaudeFrame } from '@/components/xclaude/XclaudeFrame';

// Wrapper that removes the p-6 padding from MainLayout so the iframe fills the full area
function XclaudePage({ path }: { path: string }) {
  return (
    <div className="-m-6 h-[calc(100vh-2.5rem)]">
      <XclaudeFrame path={path} />
    </div>
  );
}

export function XclaudeDashboard() {
  return <XclaudePage path="/dashboard" />;
}

export function XclaudeApiKeys() {
  return <XclaudePage path="/keys" />;
}

export function XclaudeUsage() {
  return <XclaudePage path="/usage" />;
}

export function XclaudePurchase() {
  return <XclaudePage path="/purchase" />;
}

export function XclaudeReferral() {
  return <XclaudePage path="/referral" />;
}

export function XclaudeProfile() {
  return <XclaudePage path="/profile" />;
}
