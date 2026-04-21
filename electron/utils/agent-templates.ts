/**
 * Agent Templates Service
 *
 * Loads and manages built-in agent templates from resources/agent-templates.
 * These templates can be selected by users when creating new agents.
 */

import { access, readFile, readdir, stat } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import * as logger from './logger';

export interface AgentTemplateCategory {
  id: string;
  name_zh: string;
  name_en: string;
  description_zh: string;
}

export interface AgentTemplatesConfig {
  version: number;
  categories: AgentTemplateCategory[];
  agent_category: Record<string, string>;
}

export interface AgentTemplate {
  id: string;
  name: string;
  categoryId: string;
  category?: AgentTemplateCategory;
  agentsMd?: string;
  identityMd?: string;
  soulMd?: string;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getTemplatesResourceDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources', 'agent-templates');
  }
  return join(app.getAppPath(), 'resources', 'agent-templates');
}

let cachedTemplatesConfig: AgentTemplatesConfig | null = null;

/**
 * Load the templates configuration (category.json)
 */
async function loadTemplatesConfig(): Promise<AgentTemplatesConfig | null> {
  if (cachedTemplatesConfig) {
    return cachedTemplatesConfig;
  }

  const configPath = join(getTemplatesResourceDir(), 'category.json');
  if (!(await fileExists(configPath))) {
    logger.warn('Agent templates config not found', { path: configPath });
    return null;
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    cachedTemplatesConfig = JSON.parse(content);
    return cachedTemplatesConfig;
  } catch (error) {
    logger.error('Failed to load templates config', { error: String(error) });
    return null;
  }
}

/**
 * Get all available template categories
 */
export async function getTemplateCategories(): Promise<AgentTemplateCategory[]> {
  const config = await loadTemplatesConfig();
  return config?.categories || [];
}

/**
 * Get all available agent templates (metadata only, without file contents)
 */
export async function getAgentTemplates(): Promise<AgentTemplate[]> {
  const config = await loadTemplatesConfig();
  if (!config) {
    return [];
  }

  const templatesDir = getTemplatesResourceDir();
  const templates: AgentTemplate[] = [];

  try {
    const entries = await readdir(templatesDir);

    for (const entry of entries) {
      // Skip category.json
      if (entry === 'category.json') continue;

      const entryPath = join(templatesDir, entry);
      const entryStat = await stat(entryPath);

      if (!entryStat.isDirectory()) continue;

      // Map directory name to category
      const categoryId = config.agent_category[entry] || 'software-engineering';
      const category = config.categories.find((c) => c.id === categoryId);

      templates.push({
        id: entry,
        name: entry, // The folder name is the agent name (Chinese)
        categoryId,
        category,
      });
    }

    return templates;
  } catch (error) {
    logger.error('Failed to load agent templates', { error: String(error) });
    return [];
  }
}

/**
 * Get a specific agent template with full content
 */
export async function getAgentTemplate(templateId: string): Promise<AgentTemplate | null> {
  const config = await loadTemplatesConfig();
  if (!config) {
    return null;
  }

  const templateDir = join(getTemplatesResourceDir(), templateId);
  if (!(await fileExists(templateDir))) {
    return null;
  }

  const categoryId = config.agent_category[templateId] || 'software-engineering';
  const category = config.categories.find((c) => c.id === categoryId);

  const template: AgentTemplate = {
    id: templateId,
    name: templateId,
    categoryId,
    category,
  };

  // Load template files
  const agentsPath = join(templateDir, 'AGENTS.md');
  const identityPath = join(templateDir, 'IDENTITY.md');
  const soulPath = join(templateDir, 'SOUL.md');

  if (await fileExists(agentsPath)) {
    template.agentsMd = await readFile(agentsPath, 'utf-8');
  }

  if (await fileExists(identityPath)) {
    template.identityMd = await readFile(identityPath, 'utf-8');
  }

  if (await fileExists(soulPath)) {
    template.soulMd = await readFile(soulPath, 'utf-8');
  }

  return template;
}

/**
 * Get templates grouped by category
 */
export async function getTemplatesByCategory(): Promise<Map<string, AgentTemplate[]>> {
  const templates = await getAgentTemplates();
  const grouped = new Map<string, AgentTemplate[]>();

  for (const template of templates) {
    const existing = grouped.get(template.categoryId) || [];
    existing.push(template);
    grouped.set(template.categoryId, existing);
  }

  return grouped;
}

/**
 * Search templates by name (case-insensitive, supports partial match)
 */
export async function searchTemplates(query: string): Promise<AgentTemplate[]> {
  const templates = await getAgentTemplates();
  const lowerQuery = query.toLowerCase();

  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.id.toLowerCase().includes(lowerQuery)
  );
}
