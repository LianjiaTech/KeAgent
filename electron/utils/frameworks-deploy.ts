/**
 * Agent Framework Deployment Service
 *
 * Deploys ClawTeams agent frameworks to the user's OpenClaw directory.
 * This allows users to use the multi-agent collaboration system.
 */

import { access, cp, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { getOpenClawConfigDir, getOpenClawDir } from './paths';
import { readOpenClawConfig, writeOpenClawConfig } from './channel-config';
import * as logger from './logger';

const AGENT_BOOTSTRAP_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'IDENTITY.md',
  'TOOLS.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOT.md',
];

interface SubagentsConfig {
  allowAgents: string[];
}

interface AgentDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  identity: string;
  soul: string;
  skills: string[];
  subagents?: SubagentsConfig;
}

interface FrameworksConfig {
  version: string;
  description: string;
  agents: AgentDefinition[];
  sharedSkills: string[];
}

interface BindingConfig {
  agentId: string;
  match: {
    channel: string;
    accountId?: string;
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dir: string): Promise<void> {
  if (!(await fileExists(dir))) {
    await mkdir(dir, { recursive: true });
  }
}

function getFrameworksResourceDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources', 'frameworks');
  }
  return join(app.getAppPath(), 'resources', 'frameworks');
}

/**
 * Load the frameworks configuration
 */
async function loadFrameworksConfig(): Promise<FrameworksConfig | null> {
  const configPath = join(getFrameworksResourceDir(), 'frameworks.json');
  if (!(await fileExists(configPath))) {
    return null;
  }
  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.error('Failed to load frameworks config', { error: String(error) });
    return null;
  }
}

/**
 * Deploy a single agent's workspace files
 */
async function deployAgentWorkspace(agentId: string): Promise<void> {
  const openclawDir = getOpenClawConfigDir();
  const workspaceDir = join(openclawDir, `workspace-${agentId}`);
  const agentDir = join(openclawDir, 'agents', agentId, 'agent');
  const agentSourceDir = join(getFrameworksResourceDir(), agentId);

  if (!(await fileExists(agentSourceDir))) {
    logger.warn('Agent source directory not found', { agentId, source: agentSourceDir });
    return;
  }

  // Create workspace and agent directories
  await ensureDir(workspaceDir);
  await ensureDir(agentDir);

  // Copy bootstrap files to both workspace and agentDir
  for (const file of AGENT_BOOTSTRAP_FILES) {
    const sourceFile = join(agentSourceDir, file);

    if (await fileExists(sourceFile)) {
      // Copy to workspace
      const workspaceTarget = join(workspaceDir, file);
      if (!(await fileExists(workspaceTarget))) {
        await copyFile(sourceFile, workspaceTarget);
        logger.debug('Copied agent bootstrap file to workspace', { agentId, file });
      }

      // Copy to agentDir
      const agentDirTarget = join(agentDir, file);
      if (!(await fileExists(agentDirTarget))) {
        await copyFile(sourceFile, agentDirTarget);
        logger.debug('Copied agent bootstrap file to agentDir', { agentId, file });
      }
    }
  }

  // Copy agent-specific skills to both workspace and agentDir
  const skillsSourceDir = join(agentSourceDir, 'skills');

  if (await fileExists(skillsSourceDir)) {
    // Copy to workspace/skills
    const workspaceSkillsDir = join(workspaceDir, 'skills');
    await ensureDir(workspaceSkillsDir);
    await copySkillDirectory(skillsSourceDir, workspaceSkillsDir, agentId);

    // Copy to agentDir/skills
    const agentDirSkillsDir = join(agentDir, 'skills');
    await ensureDir(agentDirSkillsDir);
    await copySkillDirectory(skillsSourceDir, agentDirSkillsDir, agentId);
  }

  logger.info('Deployed agent workspace', { agentId, workspaceDir, agentDir });
}

/**
 * Copy skill directory contents
 */
async function copySkillDirectory(
  sourceDir: string,
  targetDir: string,
  agentId: string
): Promise<void> {
  const skillDirs = await readdir(sourceDir);
  for (const skillDir of skillDirs) {
    const srcSkillPath = join(sourceDir, skillDir);
    const statResult = await stat(srcSkillPath);
    if (statResult.isDirectory()) {
      const targetSkillPath = join(targetDir, skillDir);
      if (!(await fileExists(targetSkillPath))) {
        // Use cp with recursive option to handle subdirectories (.clawhub, etc.)
        // Skip node_modules — those must be installed at the destination, not copied.
        await cp(srcSkillPath, targetSkillPath, {
          recursive: true,
          filter: (src: string) => !src.includes('node_modules'),
        });
        logger.debug('Copied agent skill', { agentId, skill: skillDir });
      }
    }
  }
}

/**
 * Deploy shared skills to the skills directory
 */
async function deploySharedSkills(): Promise<void> {
  const openclawDir = getOpenClawConfigDir();
  const skillsTargetDir = join(openclawDir, 'skills');
  const skillsSourceDir = join(getFrameworksResourceDir(), 'shared-skills');

  if (!(await fileExists(skillsSourceDir))) {
    return;
  }

  await ensureDir(skillsTargetDir);

  const skillEntries = await readdir(skillsSourceDir);
  for (const entry of skillEntries) {
    const srcPath = join(skillsSourceDir, entry);
    const statResult = await stat(srcPath);
    if (statResult.isDirectory()) {
      const targetPath = join(skillsTargetDir, entry);
      if (!(await fileExists(targetPath))) {
        await cp(srcPath, targetPath, { recursive: true });
        logger.debug('Deployed shared skill', { skill: entry });
      }
    }
  }

  logger.info('Deployed shared skills');
}

/**
 * Ensure all framework agents are in the OpenClaw configuration
 * This adds missing agents and updates subagents config for existing ones
 */
async function ensureAgentsInConfig(frameworkAgents: AgentDefinition[]): Promise<{
  added: string[];
  updated: string[];
}> {
  const config = await readOpenClawConfig();
  const agentsConfig = (config.agents as Record<string, unknown>) || {};
  const agentsList = Array.isArray(agentsConfig.list) ? [...agentsConfig.list] : [];

  const added: string[] = [];
  const updated: string[] = [];

  // Remove legacy 'main' agent entry if present
  const mainIndex = agentsList.findIndex((a: { id: string }) => a.id === 'main');
  if (mainIndex !== -1) {
    agentsList.splice(mainIndex, 1);
    logger.info('Removed legacy main agent entry from config');
  }

  // Clear any existing default flags before setting CEO as default
  for (let i = 0; i < agentsList.length; i++) {
    const entry = agentsList[i] as Record<string, unknown>;
    if (entry.default) {
      agentsList[i] = { ...entry, default: false };
    }
  }

  for (const frameworkAgent of frameworkAgents) {
    const existingIndex = agentsList.findIndex((a: { id: string }) => a.id === frameworkAgent.id);

    if (existingIndex === -1) {
      // Agent not in config, add it
      const newEntry: Record<string, unknown> = {
        id: frameworkAgent.id,
        name: frameworkAgent.name,
        workspace: `~/.keagent/workspace-${frameworkAgent.id}`,
        agentDir: `~/.keagent/agents/${frameworkAgent.id}/agent`,
      };

      if (frameworkAgent.id === 'ceo') {
        newEntry.default = true;
      }

      if (frameworkAgent.subagents && frameworkAgent.subagents.allowAgents.length > 0) {
        newEntry.subagents = frameworkAgent.subagents;
      }

      agentsList.push(newEntry);
      added.push(frameworkAgent.id);
      logger.info('Added agent to config', {
        agentId: frameworkAgent.id,
        name: frameworkAgent.name,
      });
    } else {
      // Agent exists, check if subagents needs update or default flag needs setting
      const existingEntry = agentsList[existingIndex] as Record<string, unknown>;
      let entryUpdated = false;
      let updatedEntry = { ...existingEntry };

      if (frameworkAgent.id === 'ceo' && !existingEntry.default) {
        updatedEntry = { ...updatedEntry, default: true };
        entryUpdated = true;
      }

      if (frameworkAgent.subagents && frameworkAgent.subagents.allowAgents.length > 0) {
        const existingSubagents = existingEntry.subagents as { allowAgents?: string[] } | undefined;
        const needsUpdate =
          !existingSubagents ||
          JSON.stringify(existingSubagents.allowAgents || []) !==
            JSON.stringify(frameworkAgent.subagents.allowAgents);

        if (needsUpdate) {
          updatedEntry = { ...updatedEntry, subagents: frameworkAgent.subagents };
          entryUpdated = true;
          logger.info('Updated subagents for agent', {
            agentId: frameworkAgent.id,
            allowAgents: frameworkAgent.subagents.allowAgents,
          });
        }
      }

      if (entryUpdated) {
        agentsList[existingIndex] = updatedEntry;
        updated.push(frameworkAgent.id);
      }
    }
  }

  if (added.length > 0 || updated.length > 0) {
    config.agents = {
      ...agentsConfig,
      list: agentsList,
    };
    await writeOpenClawConfig(config);
    logger.info('Updated agents configuration', { added, updated });
  }

  return { added, updated };
}

/**
 * Ensure default bindings for all configured channels
 * CEO agent binds to 'default' account of all channels
 * Other agents bind to their own accountId if configured
 */
async function ensureDefaultBindings(): Promise<void> {
  const config = await readOpenClawConfig();
  const bindings = Array.isArray(config.bindings) ? [...config.bindings] : [];

  const existingBindingKeys = new Set(
    bindings.map(
      (b: BindingConfig) => `${b.agentId}:${b.match.channel}:${b.match.accountId || 'default'}`
    )
  );

  let bindingsAdded = false;
  const channels = config.channels as
    | Record<string, { accounts?: Record<string, unknown>; enabled?: boolean }>
    | undefined;

  if (channels) {
    for (const [channelType, channelConfig] of Object.entries(channels)) {
      if (channelConfig?.enabled === false) continue;

      // Bind CEO to the 'default' account of each channel
      const ceoBindingKey = `ceo:${channelType}:default`;
      if (!existingBindingKeys.has(ceoBindingKey)) {
        bindings.push({
          agentId: 'ceo',
          match: {
            channel: channelType,
            accountId: 'default',
          },
        });
        bindingsAdded = true;
        logger.debug('Created CEO binding for channel', { channel: channelType });
      }

      // Check for agent-specific accounts and create bindings
      if (channelConfig?.accounts) {
        for (const accountId of Object.keys(channelConfig.accounts)) {
          if (accountId === 'default') continue;

          const agentBindingKey = `${accountId}:${channelType}:${accountId}`;
          if (!existingBindingKeys.has(agentBindingKey)) {
            bindings.push({
              agentId: accountId,
              match: {
                channel: channelType,
                accountId: accountId,
              },
            });
            bindingsAdded = true;
            logger.debug('Created agent binding for channel', {
              agentId: accountId,
              channel: channelType,
            });
          }
        }
      }
    }
  }

  if (bindingsAdded) {
    config.bindings = bindings;
    await writeOpenClawConfig(config);
    logger.info('Updated bindings configuration', { bindingsCount: bindings.length });
  }
}

/**
 * Deploy all agent frameworks
 * This is called once on first launch or when the user requests it
 */
export async function deployAgentFrameworks(): Promise<{
  deployed: string[];
  skipped: string[];
}> {
  const deployed: string[] = [];
  const skipped: string[] = [];

  const frameworksConfig = await loadFrameworksConfig();
  if (!frameworksConfig) {
    logger.warn('No frameworks configuration found, skipping deployment');
    return { deployed, skipped };
  }

  // Deploy workspace files for each agent
  for (const agent of frameworksConfig.agents) {
    try {
      await deployAgentWorkspace(agent.id);
      deployed.push(agent.id);
    } catch (error) {
      logger.error('Failed to deploy agent workspace', { agentId: agent.id, error: String(error) });
    }
  }

  // Deploy shared skills
  try {
    await deploySharedSkills();
  } catch (error) {
    logger.error('Failed to deploy shared skills', { error: String(error) });
  }

  // Ensure all agents are in config (adds missing ones and updates subagents)
  try {
    const { added, updated } = await ensureAgentsInConfig(frameworksConfig.agents);
    if (added.length > 0) {
      logger.info('Added agents to config', { added });
    }
    if (updated.length > 0) {
      logger.info('Updated agents in config', { updated });
    }
  } catch (error) {
    logger.error('Failed to ensure agents in config', { error: String(error) });
  }

  // Ensure bindings are configured
  try {
    await ensureDefaultBindings();
  } catch (error) {
    logger.warn('Failed to ensure default bindings', { error: String(error) });
  }

  if (deployed.length > 0) {
    logger.info('Agent frameworks deployment complete', { deployed });
  }

  return { deployed, skipped };
}

/**
 * Get list of available agent frameworks
 */
export async function getAvailableFrameworks(): Promise<AgentDefinition[]> {
  const config = await loadFrameworksConfig();
  return config?.agents || [];
}
