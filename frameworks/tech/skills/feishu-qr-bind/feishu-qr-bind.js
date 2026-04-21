/**
 * 飞书机器人二维码绑定工具（参考 openakita + 官方插件）
 * 
 * 基于 @larksuite/openclaw-lark-tools 插件的 FeishuAuth 类实现
 * 完整实现飞书 OAuth 2.0 设备授权流程
 * 
 * 参考实现：
 * - openakita/setup/feishu_onboard.py (Device Flow 三步流程)
 * - openclaw-lark/src/messaging/inbound/gate.js (dmPolicy 配置)
 * 
 * Device Flow 三步流程：
 * 1. init   → 握手，获取 supported_auth_methods
 * 2. begin  → 提交 archetype/auth_method → 返回 device_code + verification_uri
 * 3. poll   → 轮询授权状态 → 成功后返回 client_id + client_secret
 * 
 * 配置说明（参考官方插件 gate.js）：
 * dmPolicy 有效值：
 * - 'open': 允许所有用户直接发消息，不需要配对 ✅ 推荐
 * - 'pairing': 需要设备配对（默认）
 * - 'allowlist': 只允许 allowFrom 列表中的用户
 * - 'disabled': 禁用 DM
 * 
 * 绑定流程（一次扫码，全自动）：
 * 1. 用户扫 OAuth 二维码 → 飞书授权
 * 2. 自动获取 appId/appSecret
 * 3. 自动写入 OpenClaw 配置
 * 4. 自动设置 dmPolicy: 'open'（无需配对）
 * 5. 完成绑定 ✅
 * 
 * 修复内容:
 * 1. ✅ 正确的轮询逻辑（检查 client_id/client_secret 而非 status）
 * 2. ✅ 使用 API 返回的 interval 和 expire_in
 * 3. ✅ 域名自动切换（支持飞书中国和飞书国际）
 * 4. ✅ 完整的错误处理（authorization_pending, slow_down, access_denied, expired_token）
 * 5. ✅ 简化的配置管理（只处理 openclaw.json）
 * 6. ✅ 凭证验证（获取后验证 appId/appSecret）
 * 7. ✅ 修复 send_to_feishu 功能
 * 8. ✅ 自动配置 dmPolicy: 'open'（参考官方插件，无需配对）
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
  pollInterval: 5000, // 默认轮询间隔（毫秒），会被 API 返回的 interval 覆盖
  defaultTimeout: 600, // 默认超时（秒），会被 API 返回的 expire_in 覆盖
  qrSize: 512, // 二维码尺寸
  qrDir: '/tmp/openclaw', // 二维码保存目录
};

// ============================================================================
// FeishuAuth 类（基于官方插件简化版）
// ============================================================================

class FeishuAuth {
  constructor(options = {}) {
    this.env = options.env || 'prod';
    this.baseUrl = options.isLark ? LARK_OAUTH_BASE : FEISHU_OAUTH_BASE;
    this.debug = !!options.debug;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });
    
    if (this.debug) {
      this.client.interceptors.request.use(req => {
        console.log('[DEBUG] Request:', {
          host: req.baseURL,
          url: req.url,
          method: req.method,
        });
        return req;
      });
    }
  }
  
  setDomain(isLark) {
    const newBaseUrl = isLark ? LARK_OAUTH_BASE : FEISHU_OAUTH_BASE;
    this.baseUrl = newBaseUrl;
    this.client.defaults.baseURL = newBaseUrl;
    if (this.debug) {
      console.log(`[DEBUG] Updated API base URL to: ${newBaseUrl}`);
    }
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

/**
 * 读取 OpenClaw 配置文件（只处理 openclaw.json）
 */
async function readConfig() {
  const configPath = path.join(homedir(), '.openclaw', 'openclaw.json');
  
  if (!await fs.pathExists(configPath)) {
    return { channels: { feishu: { defaultAccount: 'main', accounts: {} } } };
  }
  
  const content = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 保存配置到 openclaw.json（参考官方插件 gate.js 配置结构）
 * @param {string} appId - 飞书应用 ID
 * @param {string} appSecret - 飞书应用密钥
 * @param {string} domain - 域名 (feishu | lark)
 * @param {string} accountName - 账户名称（对应 agent 的 accountId）
 * @param {string} groupPolicy - 群聊策略 (open | allowlist | disabled)
 * @param {boolean} requireMention - 群聊是否需要 @机器人
 */
async function saveConfig(appId, appSecret, domain = 'feishu', accountName = null, groupPolicy = 'open', requireMention = false) {
  const configPath = path.join(homedir(), '.openclaw', 'openclaw.json');
  
  // 读取现有配置
  let config = await readConfig();
  
  // 备份原配置
  const backupPath = `${configPath}.backup.${Date.now()}`;
  await fs.writeFile(backupPath, JSON.stringify(config, null, 2));
  
  // 确保配置结构存在
  if (!config.channels) config.channels = {};
  if (!config.channels.feishu) {
    config.channels.feishu = { defaultAccount: 'main', accounts: {} };
  }
  
  // 如果未指定账户名，使用 defaultAccount 或默认的 'main'
  const targetAccount = accountName || config.channels.feishu.defaultAccount || 'main';
  
  if (!config.channels.feishu.accounts) {
    config.channels.feishu.accounts = {};
  }
  
  // 更新账户配置（参考官方插件 gate.js 的完整配置结构）
  config.channels.feishu.accounts[targetAccount] = {
    ...config.channels.feishu.accounts[targetAccount],
    appId,
    appSecret,
    domain,
    dmPolicy: 'open',              // ✅ 无需配对
    connectionMode: 'websocket',
    enabled: true,
    groupPolicy: groupPolicy,      // 群聊策略：open | allowlist | disabled
    requireMention: requireMention, // 群聊是否需要 @机器人
  };
  
  // 如果指定了新账户，更新 defaultAccount
  if (accountName && accountName !== config.channels.feishu.defaultAccount) {
    config.channels.feishu.defaultAccount = accountName;
    console.log(`[feishu-qr-bind] 默认账户已设置为：${accountName}`);
  }
  
  // 保存配置
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`[feishu-qr-bind] 配置已保存到 openclaw.json [${targetAccount}]`);
  console.log(`[feishu-qr-bind] dmPolicy: 'open' (无需配对，所有用户可直接发消息)`);
}

// ============================================================================
// 凭证验证（参考 openakita）
// ============================================================================

/**
 * 验证飞书应用凭证（参考 openakita/setup/feishu_onboard.py）
 * 
 * 通过请求 tenant_access_token 来验证 appId/appSecret 是否有效
 * 
 * @param {string} appId - 飞书应用 ID
 * @param {string} appSecret - 飞书应用密钥
 * @returns {Promise<{valid: boolean, tenantAccessToken?: string, error?: string}>}
 */
async function validateAppCredentials(appId, appSecret) {
  const cleanAppId = appId ? appId.trim() : '';
  const cleanAppSecret = appSecret ? appSecret.trim() : '';
  
  if (!cleanAppId || !cleanAppSecret) {
    return { valid: false, error: 'appId 或 appSecret 为空' };
  }
  
  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: cleanAppId,
        app_secret: cleanAppSecret,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    
    const data = response.data;
    if (data.code === 0 && data.tenant_access_token) {
      console.log('[feishu-qr-bind] 凭证验证通过 ✅');
      return {
        valid: true,
        tenantAccessToken: data.tenant_access_token,
      };
    }
    
    console.log('[feishu-qr-bind] 凭证验证失败:', data.msg);
    return {
      valid: false,
      error: data.msg || '未知错误',
    };
  } catch (error) {
    console.log('[feishu-qr-bind] 凭证验证请求失败:', error.message);
    return {
      valid: false,
      error: error.response 
        ? `HTTP ${error.response.status}`
        : error.message,
    };
  }
}

// ============================================================================
// 二维码生成
// ============================================================================

/**
 * 生成二维码图片
 */
async function generateQRCode(url) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const filename = `feishu_qr_${timestamp}.png`;
  const outputPath = path.join(DEFAULT_CONFIG.qrDir, filename);
  
  // 确保目录存在
  await fs.ensureDir(DEFAULT_CONFIG.qrDir);
  
  // 生成 PNG 二维码
  await QRCode.toFile(outputPath, url, {
    width: DEFAULT_CONFIG.qrSize,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  
  return outputPath;
}

/**
 * 在终端渲染 ASCII 二维码（参考 openakita/setup/feishu_onboard.py）
 * 
 * 依赖 qrcode-terminal 包，不可用时 fallback 到打印 URL
 * 
 * @param {string} url - 二维码 URL
 */
async function renderQRInTerminal(url) {
  try {
    // 尝试使用 qrcode-terminal
    const qrTerminal = await import('qrcode-terminal');
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('请扫描二维码完成授权');
    console.log('');
    qrTerminal.default.generate(url, { small: true });
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
  } catch (err) {
    // fallback: 直接打印 URL
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('请在浏览器或飞书中打开以下链接：');
    console.log('');
    console.log(`  ${url}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════\n');
  }
}

// ============================================================================
// OAuth 轮询
// ============================================================================

/**
 * 轮询授权状态（参考 openakita/setup/feishu_onboard.py）
 * 
 * Device Flow Step 3: 持续轮询直到用户完成扫码或超时
 * 
 * @param {FeishuAuth} auth - FeishuAuth 实例
 * @param {string} deviceCode - 设备码
 * @param {object} beginRes - begin() 返回的结果（包含 interval 和 expire_in）
 * @returns {Promise<object>} 授权结果
 */
async function pollForResult(auth, deviceCode, beginRes) {
  const startTime = Date.now();
  
  // 使用 API 返回的 interval 和 expire_in（参考 openakita）
  const expireIn = (beginRes.expire_in || DEFAULT_CONFIG.defaultTimeout) * 1000;
  let interval = (beginRes.interval || DEFAULT_CONFIG.pollInterval / 1000) * 1000;
  
  let isLark = false;
  let domainSwitched = false;
  let attemptCount = 0;
  const maxAttempts = Math.ceil(expireIn / interval);
  
  console.log(`[feishu-qr-bind] 开始轮询，超时时间：${expireIn / 1000}秒，初始间隔：${interval / 1000}秒`);
  console.log(`[feishu-qr-bind] 最大尝试次数：${maxAttempts}`);
  
  while (Date.now() - startTime < expireIn) {
    attemptCount++;
    const pollRes = await auth.poll(deviceCode);
    
    if (process.env.DEBUG) {
      console.log('[DEBUG] Poll result:', JSON.stringify(pollRes, null, 2));
    }
    
    // 检查域名切换（参考 openakita：根据 tenant_brand 判断）
    if (pollRes.user_info?.tenant_brand === 'lark' && !domainSwitched) {
      isLark = true;
      auth.setDomain(true);
      domainSwitched = true;
      console.log('[feishu-qr-bind] 检测到飞书国际版 (lark)，切换域名');
      continue;
    }
    
    // 检查成功（修复：检查 client_id 和 client_secret，而非 status）
    if (pollRes.client_id && pollRes.client_secret) {
      console.log(`[feishu-qr-bind] 授权成功 ✅ (尝试 ${attemptCount} 次)`);
      return {
        success: true,
        appId: pollRes.client_id,
        appSecret: pollRes.client_secret,
        domain: isLark ? 'lark' : 'feishu',
        userInfo: pollRes.user_info,
        userOpenId: pollRes.user_info?.open_id,
      };
    }
    
    // 检查错误（参考 openakita 的错误处理）
    if (pollRes.error) {
      if (pollRes.error === 'authorization_pending') {
        // 用户尚未扫码，继续等待
        if (process.env.DEBUG) {
          console.log('[DEBUG] Waiting for user authorization...');
        }
      } else if (pollRes.error === 'slow_down') {
        // 请求太频繁，增加间隔（参考 openakita）
        interval += 5000;
        console.log(`[feishu-qr-bind] 收到 slow_down，新间隔：${interval / 1000}秒`);
      } else if (pollRes.error === 'access_denied') {
        console.log('[feishu-qr-bind] 用户拒绝授权 ❌');
        return { success: false, error: 'USER_CANCELLED' };
      } else if (pollRes.error === 'expired_token') {
        console.log('[feishu-qr-bind] 授权码过期 ❌');
        return { success: false, error: 'EXPIRED' };
      } else {
        console.log(`[feishu-qr-bind] 未知错误：${pollRes.error}`);
        return { success: false, error: pollRes.error };
      }
    }
    
    // 等待下一次轮询
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  console.log(`[feishu-qr-bind] 轮询超时 ❌ (尝试 ${attemptCount} 次)`);
  return { success: false, error: 'TIMEOUT' };
}

// ============================================================================
// 飞书消息发送
// ============================================================================

/**
 * 通过飞书机器人发送图片消息（修复版）
 * @param {string} imagePath - 图片本地路径
 * @param {string} userOpenId - 接收者 open_id
 * @param {string} qrUrl - 二维码 URL（可选，用于发送说明消息）
 * @param {string} sendFromAccount - 从哪个 agent 账户发送（默认 ceo，因为用户正在和 ceo 对话）
 */
async function sendImageToFeishu(imagePath, userOpenId, qrUrl, sendFromAccount = 'ceo') {
  try {
    // 读取配置获取 bot 凭证
    const config = await readConfig();
    const account = config.channels?.feishu?.accounts?.[sendFromAccount];
    
    const appId = account?.appId;
    const appSecret = account?.appSecret;
    
    console.log('[feishu-qr-bind] 使用账户:', sendFromAccount, 'AppId:', appId);
    
    if (!appId || !appSecret) {
      console.log('[feishu-qr-bind] 跳过图片发送：未配置飞书 bot 凭证');
      return { success: false, error: 'NO_BOT_CREDENTIALS' };
    }
    
    // 获取 tenant_access_token
    const tokenResponse = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    
    const tenantToken = tokenResponse.data?.tenant_access_token;
    if (!tenantToken) {
      console.log('[feishu-qr-bind] 跳过图片发送：获取 tenant token 失败');
      return { success: false, error: 'GET_TOKEN_FAILED' };
    }
    
    console.log('[feishu-qr-bind] 获取到 tenant token');
    
    // 使用 FormData 上传图片到飞书
    const form = new FormData();
    form.append('image_type', 'message');
    form.append('image', fs.createReadStream(imagePath));
    
    const uploadResponse = await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/images',
      form,
      {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          ...form.getHeaders(),
        },
        timeout: 10000,
      }
    );
    
    const imageKey = uploadResponse.data?.data?.image_key;
    if (!imageKey) {
      console.log('[feishu-qr-bind] 跳过图片发送：上传图片失败');
      return { success: false, error: 'UPLOAD_IMAGE_FAILED' };
    }
    
    console.log('[feishu-qr-bind] 图片上传成功，image_key:', imageKey);
    
    // 发送图片消息
    try {
      const sendResponse = await axios.post(
        'https://open.feishu.cn/open-apis/im/v1/messages',
        {
          receive_id: userOpenId,
          msg_type: 'image',
          content: JSON.stringify({ image_key: imageKey }),
        },
        {
          headers: {
            'Authorization': `Bearer ${tenantToken}`,
            'Content-Type': 'application/json',
          },
          params: { receive_id_type: 'open_id' },
          timeout: 10000,
        }
      );
      
      console.log('[feishu-qr-bind] 图片消息发送成功');
      
      // 如果提供了二维码 URL，再发送一条文字消息说明
      if (qrUrl) {
        const userCode = qrUrl.split('user_code=')[1] || '未知';
        await axios.post(
          'https://open.feishu.cn/open-apis/im/v1/messages',
          {
            receive_id: userOpenId,
            msg_type: 'text',
            content: JSON.stringify({
              text: `🦞 飞书绑定二维码\n\n请扫描上方图片完成授权：\n\n1. 打开飞书 App\n2. 长按识别二维码\n3. 确认授权 OpenClaw\n\nuser_code: ${userCode}\n\n或直接访问：${qrUrl}`,
            }),
          },
          {
            headers: {
              'Authorization': `Bearer ${tenantToken}`,
              'Content-Type': 'application/json',
            },
            params: { receive_id_type: 'open_id' },
            timeout: 10000,
          }
        );
        console.log('[feishu-qr-bind] 说明消息发送成功');
      }
      
      return { success: true, message_id: sendResponse.data?.data?.message_id, image_key: imageKey };
      
    } catch (sendErr) {
      console.error('[feishu-qr-bind] 发送消息错误详情:', {
        status: sendErr.response?.status,
        data: sendErr.response?.data,
        code: sendErr.response?.data?.code,
        msg: sendErr.response?.data?.msg,
      });
      throw sendErr;
    }
    
  } catch (err) {
    console.log('[feishu-qr-bind] 图片消息发送失败:', err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 飞书二维码绑定主函数（参考 openakita wizard）
 * 
 * 绑定流程（参考官方插件 + openakita）：
 * 1. 用户扫 OAuth 二维码 → 飞书授权
 * 2. 自动获取 appId/appSecret
 * 3. 自动写入 OpenClaw 配置
 * 4. 自动设置 dmPolicy: 'open'（无需配对）
 * 5. 完成绑定 ✅
 * 
 * 支持模式：
 * - 模式 1: 扫码授权（Device Flow）- 默认
 * - 模式 2: 手动输入 appId/appSecret - 适合已有凭证
 * 
 * @param {object} params - 参数对象
 * @param {string} params.domain - 域名类型 (feishu | lark)
 * @param {number} params.timeout - 超时时间（秒）
 * @param {boolean} params.save_config - 是否保存配置
 * @param {boolean} params.send_to_feishu - 是否通过飞书消息发送二维码
 * @param {string} params.user_open_id - 接收者 open_id
 * @param {string} params.account_name - 账户名称（对应 agent 的 accountId）
 * @param {string} params.app_id - 手动输入的 appId（跳过扫码）
 * @param {string} params.app_secret - 手动输入的 appSecret（跳过扫码）
 * @param {string} params.group_policy - 群聊策略 (open | allowlist | disabled)
 * @param {boolean} params.require_mention - 群聊是否需要 @机器人
 * @param {boolean} params.interactive - 是否启用交互式输出（流式）
 * @returns {Promise<object>} 绑定结果
 */
export async function feishu_qr_bind(params = {}) {
  const {
    domain,
    timeout,
    save_config = true,
    send_to_feishu = false,
    user_open_id,
    account_name,
    app_id,
    app_secret,
    group_policy = 'open',
    require_mention = false,
    interactive = true,
  } = params;
  
  // 流式输出辅助函数（参考 openakita）
  const log = {
    step: (step, title) => {
      if (interactive) {
        console.log(`\n[Step ${step}] ${title}`);
        console.log('═'.repeat(50));
      }
    },
    success: (msg) => {
      if (interactive) {
        console.log(`✅ ${msg}`);
      }
    },
    info: (msg) => {
      if (interactive) {
        console.log(`ℹ️  ${msg}`);
      }
    },
    warn: (msg) => {
      if (interactive) {
        console.log(`⚠️  ${msg}`);
      }
    },
    error: (msg) => {
      if (interactive) {
        console.log(`❌ ${msg}`);
      }
    },
  };
  
  try {
    // 模式选择：手动输入凭证 or 扫码授权
    let appIdToSave = app_id;
    let appSecretToSave = app_secret;
    let qrPath = null;
    let qrUrl = null;
    let deviceCode = null;
    let sentToFeishu = false;  // 初始化变量
    let sendError = null;       // 初始化变量
    
    if (appIdToSave && appSecretToSave) {
      // 模式 1: 手动输入凭证（参考 openakita 的 _ask_secret）
      log.step(1, '使用已有凭证');
      log.info(`App ID: ${appIdToSave.substring(0, 10)}...`);
      log.info(`App Secret: ${'*'.repeat(Math.min(appSecretToSave.length, 8))}`);
      
      // 验证凭证
      log.step(2, '验证凭证');
      const validation = await validateAppCredentials(appIdToSave, appSecretToSave);
      
      if (!validation.valid) {
        log.error(`凭证验证失败：${validation.error}`);
        return {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: `凭证验证失败：${validation.error}`,
        };
      }
      
      log.success('凭证验证通过 ✅');
      
    } else {
      // 模式 2: Device Flow 扫码授权
      log.step(1, '初始化 OAuth 会话');
      
      // 1. 创建 FeishuAuth 实例
      const isLark = domain === 'lark';
      const auth = new FeishuAuth({
        env: 'prod',
        isLark,
        debug: process.env.DEBUG === 'true',
      });
      
      // 2. 初始化 OAuth 会话
      const initResult = await auth.init();
      
      if (!initResult.supported_auth_methods?.includes('client_secret')) {
        return {
          success: false,
          error: 'INIT_FAILED',
          message: '当前环境不支持 client_secret 认证方式',
        };
      }
      
      // 3. 开始授权流程
      log.step(2, '启动 Device Flow');
      const beginResult = await auth.begin();
      
      deviceCode = beginResult.device_code;
      qrUrl = beginResult.verification_uri_complete || beginResult.qr_url;
      
      if (!deviceCode) {
        return {
          success: false,
          error: 'NO_DEVICE_CODE',
          message: '未能获取设备授权码',
        };
      }
      
      log.info(`Device Code: ${deviceCode.substring(0, 20)}...`);
      log.info(`QR URL: ${qrUrl}`);
      
      // 4. 生成二维码图片
      log.step(3, '生成二维码');
      qrPath = await generateQRCode(qrUrl);
      log.success(`二维码已保存：${qrPath}`);
      
      // 4a. 如果请求发送到飞书，上传图片并发送消息
      let sentToFeishu = false;
      let sendError = null;
      
      if (send_to_feishu) {
        log.step(4, '发送二维码到飞书');
        const targetOpenId = user_open_id || process.env.SENDER_ID || process.env.USER_OPEN_ID;
        
        if (targetOpenId) {
          const sendResult = await sendImageToFeishu(qrPath, targetOpenId, qrUrl, account_name || 'ceo');
          sentToFeishu = sendResult.success;
          if (!sendResult.success) {
            sendError = sendResult.error;
            log.warn(`发送飞书消息失败：${sendError}`);
          } else {
            log.success('二维码已发送到飞书 ✅');
          }
        } else {
          log.warn('跳过图片发送：未提供 user_open_id');
          sendError = 'NO_USER_OPEN_ID';
        }
      }
      
      // 4b. 输出提示信息（参考 openakita + 官方插件）
      log.step(5, '等待授权');
      await renderQRInTerminal(qrUrl);
      
      log.info(`二维码路径：${qrPath}`);
      log.info(`操作步骤：`);
      log.info(`  1. 打开飞书 App`);
      log.info(`  2. 扫描二维码或访问 URL`);
      log.info(`  3. 确认授权 OpenClaw`);
      log.info(`超时时间：${beginResult.expire_in || DEFAULT_CONFIG.defaultTimeout}秒`);
      
      // 5. 轮询等待授权
      const authResult = await pollForResult(auth, deviceCode, beginResult);
      
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error,
          message: getErrorMessage(authResult.error),
          qr_path: qrPath,
          qr_url: qrUrl,
          device_code: deviceCode,
        };
      }
      
      appIdToSave = authResult.appId;
      appSecretToSave = authResult.appSecret;
      
      // 6. 验证凭证
      log.step(6, '验证凭证');
      const isValid = await validateAppCredentials(appIdToSave, appSecretToSave);
      if (!isValid.valid) {
        return {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: `凭证验证失败：${isValid.error}`,
          qr_path: qrPath,
          qr_url: qrUrl,
          device_code: deviceCode,
        };
      }
      log.success('凭证验证通过 ✅');
    }
    
    // 7. 保存配置（参考官方插件 gate.js 配置结构）
    if (save_config) {
      log.step(7, '保存配置');
      await saveConfig(
        appIdToSave,
        appSecretToSave,
        domain || 'feishu',
        account_name || 'ceo',
        group_policy,
        require_mention
      );
      log.success(`配置已保存到账户 [${account_name || 'ceo'}] ✅`);
    }
    
    // 8. 返回成功结果
    log.step(8, '完成');
    log.success('飞书机器人绑定完成！🎉');
    
    return {
      success: true,
      qr_path: qrPath,
      qr_url: qrUrl,
      device_code: deviceCode,
      app_id: appIdToSave,
      app_secret: appSecretToSave,
      account_name: account_name || 'ceo',
      send_to_feishu,
      sent_to_feishu: sentToFeishu,
      send_error: sendError,
      group_policy,
      require_mention,
      message: `飞书机器人绑定成功！配置已保存到账户 [${account_name || 'ceo'}]（dmPolicy: open，无需配对）`,
    };
    
  } catch (err) {
    console.error('[feishu-qr-bind] 未预期的错误:', err);
    return {
      success: false,
      error: 'UNEXPECTED_ERROR',
      message: `绑定失败：${err.message}`,
    };
  }
}

/**
 * 获取错误消息
 */
function getErrorMessage(error) {
  const messages = {
    'TIMEOUT': '授权超时，请重新生成二维码',
    'USER_CANCELLED': '用户取消了授权',
    'EXPIRED': '授权码已过期，请重新生成',
    'ACCESS_DENIED': '访问被拒绝',
    'NO_DEVICE_CODE': '未能获取设备授权码',
    'NO_CREDENTIALS': '未能获取应用凭证',
    'INVALID_CREDENTIALS': '凭证验证失败',
    'INIT_FAILED': '初始化失败',
    'NO_BOT_CREDENTIALS': '未配置飞书 bot 凭证',
    'GET_TOKEN_FAILED': '获取 token 失败',
    'UPLOAD_IMAGE_FAILED': '上传图片失败',
    'NO_USER_OPEN_ID': '未提供 user_open_id',
  };
  return messages[error] || '未知错误';
}

// ============================================================================
// 导出
// ============================================================================

export const tool = {
  name: 'feishu_qr_bind',
  description: '飞书机器人二维码绑定工具，通过 OAuth 设备授权流程完成绑定。支持绑定到指定的 agent 账户，自动配置 dmPolicy: open（无需配对，所有用户可直接发消息）。',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: '飞书域名 (feishu | lark)',
        enum: ['feishu', 'lark'],
      },
      timeout: {
        type: 'number',
        description: '轮询超时时间（秒）',
        default: 600,
      },
      save_config: {
        type: 'boolean',
        description: '是否自动保存配置',
        default: true,
      },
      send_to_feishu: {
        type: 'boolean',
        description: '是否通过飞书消息发送二维码图片给用户。如果未提供 user_open_id，会自动识别当前用户',
        default: false,
      },
      user_open_id: {
        type: 'string',
        description: '接收者的飞书 open_id（可选，send_to_feishu=true 时如果不提供会自动识别当前用户）',
      },
      account_name: {
        type: 'string',
        description: '账户名称（对应 agent 的 accountId，如 ceo、tech、secretary 等），默认为 ceo',
        default: 'ceo',
      },
    },
  },
  handler: feishu_qr_bind,
};

export default feishu_qr_bind;
