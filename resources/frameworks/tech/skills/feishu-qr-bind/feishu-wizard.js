/**
 * 飞书机器人配置向导（参考 openakita wizard）
 * 
 * 支持功能：
 * 1. 流式输出（交互式进度显示）
 * 2. 群聊回复模式配置（groupPolicy）
 * 3. 支持自定义输入 appId/appSecret
 * 4. Device Flow 扫码授权
 * 5. 自动配置 dmPolicy: 'open'（无需配对）
 * 
 * @param {object} options - 配置选项
 */

import axios from 'axios';
import QRCode from 'qrcode';
import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';
import FormData from 'form-data';

// ============================================================================
// 配置
// ============================================================================

const FEISHU_OAUTH_BASE = 'https://accounts.feishu.cn';
const LARK_OAUTH_BASE = 'https://accounts.larksuite.com';

const DEFAULT_CONFIG = {
  pollInterval: 5000,
  defaultTimeout: 600,
  qrSize: 512,
  qrDir: '/tmp/openclaw',
};

// ============================================================================
// 流式输出（参考 openakita 的 Rich Console）
// ============================================================================

class ConsoleLogger {
  constructor(interactive = true) {
    this.interactive = interactive;
  }
  
  step(num, title) {
    if (this.interactive) {
      console.log(`\n[Step ${num}] ${title}`);
      console.log('═'.repeat(60));
    }
  }
  
  success(msg) {
    if (this.interactive) {
      console.log(`✅ ${msg}`);
    }
  }
  
  info(msg) {
    if (this.interactive) {
      console.log(`ℹ️  ${msg}`);
    }
  }
  
  warn(msg) {
    if (this.interactive) {
      console.log(`⚠️  ${msg}`);
    }
  }
  
  error(msg) {
    if (this.interactive) {
      console.log(`❌ ${msg}`);
    }
  }
  
  progress(msg) {
    if (this.interactive) {
      console.log(`⏳ ${msg}`);
    }
  }
}

// ============================================================================
// FeishuAuth 类（Device Flow）
// ============================================================================

class FeishuAuth {
  constructor(options = {}) {
    this.env = options.env || 'prod';
    this.baseUrl = options.isLark ? LARK_OAUTH_BASE : FEISHU_OAUTH_BASE;
    this.debug = !!options.debug;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });
  }
  
  setDomain(isLark) {
    this.baseUrl = isLark ? LARK_OAUTH_BASE : FEISHU_OAUTH_BASE;
    this.client.defaults.baseURL = this.baseUrl;
  }
  
  async init() {
    const response = await this.client.post(
      '/oauth/v1/app/registration',
      new URLSearchParams({ action: 'init' }).toString()
    );
    return response.data;
  }
  
  async begin() {
    const response = await this.client.post(
      '/oauth/v1/app/registration',
      new URLSearchParams({
        action: 'begin',
        archetype: 'PersonalAgent',
        auth_method: 'client_secret',
        request_user_info: 'open_id',
      }).toString()
    );
    return response.data;
  }
  
  async poll(deviceCode) {
    try {
      const response = await this.client.post(
        '/oauth/v1/app/registration',
        new URLSearchParams({
          action: 'poll',
          device_code: deviceCode,
        }).toString()
      );
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        return error.response.data;
      }
      throw error;
    }
  }
}

// ============================================================================
// 配置管理
// ============================================================================

async function readConfig() {
  const configPath = path.join(homedir(), '.keagent', 'openclaw.json');
  if (!await fs.pathExists(configPath)) {
    return { channels: { feishu: { defaultAccount: 'main', accounts: {} } } };
  }
  const content = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 保存配置（参考官方插件 gate.js 配置结构）
 */
async function saveConfig(appId, appSecret, domain, accountName, groupPolicy = 'open', requireMention = false) {
  const configPath = path.join(homedir(), '.keagent', 'openclaw.json');
  let config = await readConfig();
  
  // 备份
  const backupPath = `${configPath}.backup.${Date.now()}`;
  await fs.writeFile(backupPath, JSON.stringify(config, null, 2));
  
  // 确保结构存在
  if (!config.channels) config.channels = {};
  if (!config.channels.feishu) {
    config.channels.feishu = { defaultAccount: 'main', accounts: {} };
  }
  
  const targetAccount = accountName || config.channels.feishu.defaultAccount || 'main';
  if (!config.channels.feishu.accounts) {
    config.channels.feishu.accounts = {};
  }
  
  // 更新配置（参考官方插件的完整结构）
  config.channels.feishu.accounts[targetAccount] = {
    ...config.channels.feishu.accounts[targetAccount],
    appId,
    appSecret,
    domain,
    dmPolicy: 'open',        // ✅ 无需配对
    connectionMode: 'websocket',
    enabled: true,
    groupPolicy: groupPolicy, // 群聊策略：open | allowlist | disabled
    requireMention: requireMention, // 群聊是否需要 @机器人
  };
  
  if (accountName && accountName !== config.channels.feishu.defaultAccount) {
    config.channels.feishu.defaultAccount = accountName;
  }
  
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`[feishu-wizard] 配置已保存到 [${targetAccount}]`);
}

// ============================================================================
// 凭证验证（参考 openakita）
// ============================================================================

async function validateCredentials(appId, appSecret) {
  const cleanAppId = appId?.trim() || '';
  const cleanAppSecret = appSecret?.trim() || '';
  
  if (!cleanAppId || !cleanAppSecret) {
    return { valid: false, error: 'appId 或 appSecret 为空' };
  }
  
  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      { app_id: cleanAppId, app_secret: cleanAppSecret },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    
    const data = response.data;
    if (data.code === 0 && data.tenant_access_token) {
      return { valid: true, tenantAccessToken: data.tenant_access_token };
    }
    return { valid: false, error: data.msg || '未知错误' };
  } catch (error) {
    return { valid: false, error: error.response ? `HTTP ${error.response.status}` : error.message };
  }
}

// ============================================================================
// 二维码生成
// ============================================================================

async function generateQRCode(url) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const filename = `feishu_qr_${timestamp}.png`;
  const outputPath = path.join(DEFAULT_CONFIG.qrDir, filename);
  await fs.ensureDir(DEFAULT_CONFIG.qrDir);
  await QRCode.toFile(outputPath, url, { width: DEFAULT_CONFIG.qrSize, margin: 2, errorCorrectionLevel: 'M' });
  return outputPath;
}

async function renderQRInTerminal(url) {
  try {
    const qrTerminal = await import('qrcode-terminal');
    console.log('\n' + '═'.repeat(60));
    console.log('请扫描二维码完成授权');
    console.log('═'.repeat(60));
    qrTerminal.default.generate(url, { small: true });
    console.log('═'.repeat(60) + '\n');
  } catch (err) {
    console.log(`\n请在浏览器或飞书中打开：\n  ${url}\n`);
  }
}

// ============================================================================
// Device Flow 轮询（参考 openakita）
// ============================================================================

async function pollForResult(auth, deviceCode, beginRes, log) {
  const startTime = Date.now();
  const expireIn = (beginRes.expire_in || DEFAULT_CONFIG.defaultTimeout) * 1000;
  let interval = (beginRes.interval || DEFAULT_CONFIG.pollInterval / 1000) * 1000;
  let isLark = false;
  let domainSwitched = false;
  let attemptCount = 0;
  
  log.progress(`开始轮询（超时：${expireIn / 1000}秒，间隔：${interval / 1000}秒）`);
  
  while (Date.now() - startTime < expireIn) {
    attemptCount++;
    const pollRes = await auth.poll(deviceCode);
    
    // 域名切换
    if (pollRes.user_info?.tenant_brand === 'lark' && !domainSwitched) {
      isLark = true;
      auth.setDomain(true);
      domainSwitched = true;
      log.info('检测到飞书国际版，切换域名');
      continue;
    }
    
    // 成功
    if (pollRes.client_id && pollRes.client_secret) {
      log.success(`授权成功（尝试 ${attemptCount} 次）`);
      return {
        success: true,
        appId: pollRes.client_id,
        appSecret: pollRes.client_secret,
        domain: isLark ? 'lark' : 'feishu',
        userOpenId: pollRes.user_info?.open_id,
      };
    }
    
    // 错误处理
    if (pollRes.error) {
      if (pollRes.error === 'authorization_pending') {
        // 继续等待
      } else if (pollRes.error === 'slow_down') {
        interval += 5000;
        log.warn(`收到 slow_down，新间隔：${interval / 1000}秒`);
      } else if (pollRes.error === 'access_denied') {
        log.error('用户拒绝授权');
        return { success: false, error: 'USER_CANCELLED' };
      } else if (pollRes.error === 'expired_token') {
        log.error('授权码过期');
        return { success: false, error: 'EXPIRED' };
      } else {
        log.error(`未知错误：${pollRes.error}`);
        return { success: false, error: pollRes.error };
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  log.error(`轮询超时（尝试 ${attemptCount} 次）`);
  return { success: false, error: 'TIMEOUT' };
}

// ============================================================================
// 飞书消息发送
// ============================================================================

async function sendImageToFeishu(imagePath, userOpenId, qrUrl, sendFromAccount = 'ceo') {
  try {
    const config = await readConfig();
    const account = config.channels?.feishu?.accounts?.[sendFromAccount];
    const appId = account?.appId;
    const appSecret = account?.appSecret;
    
    if (!appId || !appSecret) {
      return { success: false, error: 'NO_BOT_CREDENTIALS' };
    }
    
    // 获取 tenant token
    const tokenResponse = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      { app_id: appId, app_secret: appSecret },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    
    const tenantToken = tokenResponse.data?.tenant_access_token;
    if (!tenantToken) {
      return { success: false, error: 'GET_TOKEN_FAILED' };
    }
    
    // 上传图片
    const form = new FormData();
    form.append('image_type', 'message');
    form.append('image', fs.createReadStream(imagePath));
    
    const uploadResponse = await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/images',
      form,
      { headers: { 'Authorization': `Bearer ${tenantToken}`, ...form.getHeaders() }, timeout: 10000 }
    );
    
    const imageKey = uploadResponse.data?.data?.image_key;
    if (!imageKey) {
      return { success: false, error: 'UPLOAD_IMAGE_FAILED' };
    }
    
    // 发送图片消息
    await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages',
      { receive_id: userOpenId, msg_type: 'image', content: JSON.stringify({ image_key: imageKey }) },
      { headers: { 'Authorization': `Bearer ${tenantToken}`, 'Content-Type': 'application/json' }, params: { receive_id_type: 'open_id' }, timeout: 10000 }
    );
    
    // 发送说明消息
    if (qrUrl) {
      const userCode = qrUrl.split('user_code=')[1] || '未知';
      await axios.post(
        'https://open.feishu.cn/open-apis/im/v1/messages',
        {
          receive_id: userOpenId,
          msg_type: 'text',
          content: JSON.stringify({ text: `🦞 飞书绑定二维码\n\nuser_code: ${userCode}\n\n或直接访问：${qrUrl}` }),
        },
        { headers: { 'Authorization': `Bearer ${tenantToken}`, 'Content-Type': 'application/json' }, params: { receive_id_type: 'open_id' }, timeout: 10000 }
      );
    }
    
    return { success: true, image_key: imageKey };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 主函数（参考 openakita wizard）
// ============================================================================

export async function feishu_wizard(options = {}) {
  const {
    domain = 'feishu',
    account_name = 'ceo',
    app_id,
    app_secret,
    group_policy = 'open',
    require_mention = false,
    send_to_feishu = false,
    user_open_id,
    interactive = true,
  } = options;
  
  const log = new ConsoleLogger(interactive);
  
  try {
    let appIdToSave = app_id;
    let appSecretToSave = app_secret;
    let qrPath = null;
    let qrUrl = null;
    
    // 模式选择
    if (appIdToSave && appSecretToSave) {
      // 模式 1: 手动输入凭证
      log.step(1, '使用已有凭证');
      log.info(`App ID: ${appIdToSave.substring(0, 10)}...`);
      log.info(`App Secret: ${'*'.repeat(Math.min(appSecretToSave.length, 8))}`);
      
      log.step(2, '验证凭证');
      const validation = await validateCredentials(appIdToSave, appSecretToSave);
      if (!validation.valid) {
        log.error(`凭证验证失败：${validation.error}`);
        return { success: false, error: 'INVALID_CREDENTIALS', message: validation.error };
      }
      log.success('凭证验证通过 ✅');
      
    } else {
      // 模式 2: Device Flow 扫码
      log.step(1, '初始化 OAuth 会话');
      const auth = new FeishuAuth({ env: 'prod', isLark: domain === 'lark' });
      
      const initResult = await auth.init();
      if (!initResult.supported_auth_methods?.includes('client_secret')) {
        return { success: false, error: 'INIT_FAILED', message: '不支持 client_secret 认证' };
      }
      
      log.step(2, '启动 Device Flow');
      const beginResult = await auth.begin();
      qrUrl = beginResult.verification_uri_complete || beginResult.qr_url;
      const deviceCode = beginResult.device_code;
      
      if (!deviceCode) {
        return { success: false, error: 'NO_DEVICE_CODE', message: '未能获取设备授权码' };
      }
      
      log.step(3, '生成二维码');
      qrPath = await generateQRCode(qrUrl);
      log.success(`二维码已保存：${qrPath}`);
      
      // 发送到飞书
      if (send_to_feishu) {
        log.step(4, '发送二维码到飞书');
        const targetOpenId = user_open_id || process.env.SENDER_ID;
        if (targetOpenId) {
          const sendResult = await sendImageToFeishu(qrPath, targetOpenId, qrUrl, account_name);
          if (sendResult.success) {
            log.success('二维码已发送到飞书 ✅');
          }
        }
      }
      
      log.step(5, '等待授权');
      await renderQRInTerminal(qrUrl);
      
      const authResult = await pollForResult(auth, deviceCode, beginResult, log);
      if (!authResult.success) {
        return { success: false, error: authResult.error, message: getErrorMessage(authResult.error) };
      }
      
      appIdToSave = authResult.appId;
      appSecretToSave = authResult.appSecret;
      
      log.step(6, '验证凭证');
      const isValid = await validateCredentials(appIdToSave, appSecretToSave);
      if (!isValid.valid) {
        return { success: false, error: 'INVALID_CREDENTIALS', message: isValid.error };
      }
      log.success('凭证验证通过 ✅');
    }
    
    // 保存配置
    log.step(7, '保存配置');
    await saveConfig(appIdToSave, appSecretToSave, domain, account_name, group_policy, require_mention);
    log.success(`配置已保存到 [${account_name}] ✅`);
    
    log.step(8, '完成');
    log.success('飞书机器人绑定完成！🎉');
    
    return {
      success: true,
      app_id: appIdToSave,
      app_secret: appSecretToSave,
      account_name,
      group_policy,
      require_mention,
      message: `绑定成功！dmPolicy: open（无需配对）`,
    };
    
  } catch (err) {
    log.error(`未预期的错误：${err.message}`);
    return { success: false, error: 'UNEXPECTED_ERROR', message: err.message };
  }
}

function getErrorMessage(error) {
  const messages = {
    'TIMEOUT': '授权超时',
    'USER_CANCELLED': '用户取消授权',
    'EXPIRED': '授权码过期',
    'INVALID_CREDENTIALS': '凭证无效',
  };
  return messages[error] || error;
}

// ============================================================================
// 导出
// ============================================================================

export const tool = {
  name: 'feishu_wizard',
  description: '飞书机器人配置向导（参考 openakita）。支持扫码授权或手动输入凭证，可配置群聊回复模式。',
  inputSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string', enum: ['feishu', 'lark'], description: '飞书域名' },
      account_name: { type: 'string', default: 'ceo', description: '账户名称' },
      app_id: { type: 'string', description: '手动输入的 App ID（可选，跳过扫码）' },
      app_secret: { type: 'string', description: '手动输入的 App Secret（可选，跳过扫码）' },
      group_policy: { type: 'string', enum: ['open', 'allowlist', 'disabled'], default: 'open', description: '群聊策略' },
      require_mention: { type: 'boolean', default: false, description: '群聊是否需要 @机器人' },
      send_to_feishu: { type: 'boolean', default: false, description: '是否发送二维码到飞书' },
      user_open_id: { type: 'string', description: '接收者 open_id' },
      interactive: { type: 'boolean', default: true, description: '是否启用交互式输出' },
    },
  },
  handler: feishu_wizard,
};

export default feishu_wizard;
