import type { ProviderAccount } from '../../shared/providers/types';
import { listProviderAccounts, saveProviderAccount, setDefaultProviderAccount } from './provider-store';
import { logger } from '../../utils/logger';

/**
 * Deterministic account ID matching xclaude-sync.ts xclaudeAccountId().
 * Format: xclaude-{model} with non-alphanum chars replaced by dashes.
 */
function xclaudeAccountId(model: string): string {
  return `xclaude-${model.replace(/[^a-z0-9-]/gi, '-')}`;
}

/**
 * Bootstrap default Xclaude provider accounts from VITE_DEFAULT_MODELS env var.
 *
 * Runs on every startup. Creates any missing per-model Xclaude accounts
 * (deduplicated, deterministic IDs), and sets the first account as default
 * if no default is currently set. Accounts without API keys are created as
 * placeholders; xclaude-sync fills in the key after login.
 */
export async function bootstrapDefaultProviders(): Promise<void> {
  const modelsEnv = (import.meta.env.VITE_DEFAULT_MODELS as string | undefined);
  if (!modelsEnv) {
    logger.debug('[provider-bootstrap] VITE_DEFAULT_MODELS not set; skipping');
    return;
  }

  const models = [...new Set(
    modelsEnv.split(',').map((m) => m.trim()).filter(Boolean),
  )];

  if (models.length === 0) {
    logger.debug('[provider-bootstrap] VITE_DEFAULT_MODELS is empty; skipping');
    return;
  }

  const existingAccounts = await listProviderAccounts();
  const existingIds = new Set(existingAccounts.map((a) => a.id));
  const hasDefault = existingAccounts.some((a) => a.isDefault);

  const now = new Date().toISOString();
  let firstAccountId: string | undefined;
  let created = 0;

  for (const model of models) {
    const id = xclaudeAccountId(model);
    if (!firstAccountId) {
      firstAccountId = id;
    }

    if (existingIds.has(id)) {
      continue;
    }

    const account: ProviderAccount = {
      id,
      vendorId: 'xclaude',
      label: `Xclaude (${model})`,
      authMode: 'api_key',
      apiProtocol: 'anthropic-messages',
      model,
      enabled: true,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };
    await saveProviderAccount(account);
    created++;
    logger.info(`[provider-bootstrap] Created Xclaude account "${id}" for model "${model}"`);
  }

  // Set default to first model's account if none is set yet
  if (!hasDefault && firstAccountId) {
    await setDefaultProviderAccount(firstAccountId);
    logger.info(`[provider-bootstrap] Set default provider account to "${firstAccountId}"`);
  }

  if (created > 0) {
    logger.info(`[provider-bootstrap] Bootstrapped ${created} new Xclaude account(s)`);
  }
}
