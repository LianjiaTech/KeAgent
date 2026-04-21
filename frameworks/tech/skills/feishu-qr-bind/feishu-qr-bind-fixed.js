/**
 * 飞书机器人二维码绑定工具 (修复版)
 * 
 * 基于 @larksuite/openclaw-lark-tools 插件的 FeishuAuth 类实现
 * 完整实现飞书 OAuth 2.0 设备授权流程
 * 
 * 修复内容:
 * 1. ✅ 正确的轮询逻辑（检查 client_id/client_secret 而非 status）
 * 2. ✅ 使用 API 返回的 interval 和 expire_in
 * 3. ✅ 域名自动切换（支持飞书中国和飞书国际）
 * 4. ✅ 完整的错误处理（authorization_pending, slow_down, access_denied, expired_token）
 * 5. ✅ 简化的配置管理（只处理 openclaw.json）
 * 6. ✅ 凭证验证（获取后验证 appId/appSecret）
 * 7. ✅ 修复 send_to_feishu 功能
 */

import axios from 'axios';
import QRCode from 'qrcode';
import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';

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
  const configPath = path.join(homedir(), '.keagent', 'openclaw.json');
  
  if (!await fs.pathExists(configPath)) {
    return { channels: { feishu: { defaultAccount: 'main', accounts: {} } } };
  }
  
  const content = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 保存配置到 openclaw.json
 */
async function saveConfig(appId, appSecret, domain = 'feishu') {
  const configPath = path.join(homedir(), '.keagent', 'openclaw.json');
  
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
  
  const accountName = config.channels.feishu.defaultAccount || 'main';
  if (!config.channels.feishu.accounts) {
    config.channels.feishu.accounts = {};
  }
  
  // 更新账户配置（保留现有配置）
  config.channels.feishu.accounts[accountName] = {
    ...config.channels.feishu.accounts[accountName],
    appId,
    appSecret,
    domain,
  };
  
  // 保存配置
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log('[feishu-qr-bind] 配置已保存到 openclaw.json');
}

// ============================================================================
// 凭证验证
// ============================================================================

/**
 * 验证飞书应用凭证
 */
async function validateAppCredentials(appId, appSecret) {
  const cleanAppId = appId ? appId.trim() : '';
  const cleanAppSecret = appSecret ? appSecret.trim() : '';
  
  if (!cleanAppId || !cleanAppSecret) {
    return false;
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
        timeout: 10000,
      }
    );
    
    return response.data && response.data.code === 0 && response.data.tenant_access_token;
  } catch (error) {
    return false;
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

// ============================================================================
// OAuth 轮询
// ============================================================================

/**
 * 轮询授权状态（修复版）
 */
async function pollForResult(auth, deviceCode, beginRes) {
  const startTime = Date.now();
  const expireIn = (beginRes.expire_in || DEFAULT_CONFIG.defaultTimeout) * 1000;
  let interval = (beginRes.interval || DEFAULT_CONFIG.pollInterval / 1000) * 1000;
  let isLark = false;
  let domainSwitched = false;
  
  console.log(`[feishu-qr-bind] 开始轮询，超时时间：${expireIn / 1000}秒，初始间隔：${interval / 1000}秒`);
  
  while (Date.now() - startTime < expireIn) {
    const pollRes = await auth.poll(deviceCode);
    
    if (process.env.DEBUG) {
      console.log('[DEBUG] Poll result:', JSON.stringify(pollRes, null, 2));
    }
    
    // 检查域名切换
    if (pollRes.user_info?.tenant_brand === 'lark' && !domainSwitched) {
      isLark = true;
      auth.setDomain(true);
      domainSwitched = true;
      console.log('[feishu-qr-bind] 检测到飞书国际版，切换域名');
      continue;
    }
    
    // 检查成功（修复：检查 client_id 和 client_secret，而非 status）
    if (pollRes.client_id && pollRes.client_secret) {
      console.log('[feishu-qr-bind] 授权成功');
      return {
        success: true,
        appId: pollRes.client_id,
        appSecret: pollRes.client_secret,
        domain: isLark ? 'lark' : 'feishu',
        userInfo: pollRes.user_info,
      };
    }
    
    // 检查错误（修复：基于 error 字段处理）
    if (pollRes.error) {
      if (pollRes.error === 'authorization_pending') {
        // 用户尚未扫码，继续等待
        if (process.env.DEBUG) {
          console.log('[DEBUG] Waiting for user authorization...');
        }
      } else if (pollRes.error === 'slow_down') {
        // 请求太频繁，增加间隔
        interval += 5000;
        console.log(`[feishu-qr-bind] 收到 slow_down，新间隔：${interval / 1000}秒`);
      } else if (pollRes.error === 'access_denied') {
        console.log('[feishu-qr-bind] 用户拒绝授权');
        return { success: false, error: 'USER_CANCELLED' };
      } else if (pollRes.error === 'expired_token') {
        console.log('[feishu-qr-bind] 授权码过期');
        return { success: false, error: 'EXPIRED' };
      } else {
        console.log(`[feishu-qr-bind] 未知错误：${pollRes.error}`);
        return { success: false, error: pollRes.error };
      }
    }
    
    // 等待下一次轮询
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  console.log('[feishu-qr-bind] 轮询超时');
  return { success: false, error: 'TIMEOUT' };
}

// ============================================================================
// 飞书消息发送
// ============================================================================

/**
 * 通过飞书机器人发送图片消息（修复版）
 */
async function sendImageToFeishu(imagePath, userOpenId) {
  try {
    // 读取配置获取 bot 凭证
    const config = await readConfig();
    const accountName = config.channels?.feishu?.defaultAccount || 'main';
    const account = config.channels?.feishu?.accounts?.[accountName];
    
    const appId = account?.appId;
    const appSecret = account?.appSecret;
    
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
    
    // 上传图片到飞书
    const imageBuffer = await fs.readFile(imagePath);
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
    
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="image"; filename="image.png"',
      'Content-Type: image/png',
      '',
      imageBuffer.toString('binary'),
      `--${boundary}--`,
    ].join('\r\n');
    
    const uploadResponse = await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/images',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        timeout: 10000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    
    const imageKey = uploadResponse.data?.data?.image_key;
    if (!imageKey) {
      console.log('[feishu-qr-bind] 跳过图片发送：上传图片失败');
      return { success: false, error: 'UPLOAD_IMAGE_FAILED' };
    }
    
    // 发送图片消息
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
    return { success: true, message_id: sendResponse.data?.data?.message_id };
    
  } catch (err) {
    console.log('[feishu-qr-bind] 图片消息发送失败:', err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 飞书二维码绑定主函数
 * @param {object} params - 参数对象
 * @param {string} params.domain - 域名类型 (feishu | lark)
 * @param {number} params.timeout - 超时时间（秒）
 * @param {boolean} params.save_config - 是否保存配置
 * @param {boolean} params.send_to_feishu - 是否通过飞书消息发送二维码
 * @param {string} params.user_open_id - 接收者 open_id
 * @returns {Promise<object>} 绑定结果
 */
export async function feishu_qr_bind(params = {}) {
  const {
    domain,
    timeout,
    save_config = true,
    send_to_feishu = false,
    user_open_id,
  } = params;
  
  try {
    // 1. 创建 FeishuAuth 实例
    const isLark = domain === 'lark';
    const auth = new FeishuAuth({
      env: 'prod',
      isLark,
      debug: process.env.DEBUG === 'true',
    });
    
    // 2. 初始化 OAuth 会话
    console.log('[feishu-qr-bind] 初始化 OAuth 会话...');
    const initResult = await auth.init();
    
    if (!initResult.supported_auth_methods?.includes('client_secret')) {
      return {
        success: false,
        error: 'INIT_FAILED',
        message: '当前环境不支持 client_secret 认证方式',
      };
    }
    
    // 3. 开始授权流程
    console.log('[feishu-qr-bind] 开始授权流程...');
    const beginResult = await auth.begin();
    
    const deviceCode = beginResult.device_code;
    const qrUrl = beginResult.verification_uri_complete || beginResult.qr_url;
    
    if (!deviceCode) {
      return {
        success: false,
        error: 'NO_DEVICE_CODE',
        message: '未能获取设备授权码',
      };
    }
    
    console.log(`[feishu-qr-bind] 获取到 device_code: ${deviceCode.substring(0, 20)}...`);
    console.log(`[feishu-qr-bind] 二维码 URL: ${qrUrl}`);
    
    // 4. 生成二维码图片
    console.log('[feishu-qr-bind] 生成二维码图片...');
    const qrPath = await generateQRCode(qrUrl);
    console.log(`[feishu-qr-bind] 二维码已保存：${qrPath}`);
    
    // 4a. 如果请求发送到飞书，上传图片并发送消息
    let sentToFeishu = false;
    let sendError = null;
    
    if (send_to_feishu) {
      const targetOpenId = user_open_id;
      
      if (targetOpenId) {
        console.log('[feishu-qr-bind] 发送图片到飞书...');
        const sendResult = await sendImageToFeishu(qrPath, targetOpenId);
        sentToFeishu = sendResult.success;
        if (!sendResult.success) {
          sendError = sendResult.error;
          console.log('[feishu-qr-bind] 发送飞书消息失败:', sendError);
        }
      } else {
        console.log('[feishu-qr-bind] 跳过图片发送：未提供 user_open_id');
        sendError = 'NO_USER_OPEN_ID';
      }
    }
    
    // 4b. 输出提示信息
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('请扫描二维码完成授权');
    console.log('');
    console.log(`二维码路径：${qrPath}`);
    console.log(`二维码 URL: ${qrUrl}`);
    console.log('');
    console.log('操作步骤：');
    console.log('1. 打开飞书 App');
    console.log('2. 扫描下方二维码，或访问二维码 URL');
    console.log('3. 确认授权 OpenClaw 访问您的飞书账号');
    console.log('');
    console.log(`等待授权中...（超时时间：${beginResult.expire_in || DEFAULT_CONFIG.defaultTimeout}秒）`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
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
        send_to_feishu,
        sent_to_feishu: sentToFeishu,
        send_error: sendError,
      };
    }
    
    const { appId, appSecret } = authResult;
    
    if (!appId || !appSecret) {
      return {
        success: false,
        error: 'NO_CREDENTIALS',
        message: '未能获取应用凭证',
        qr_path: qrPath,
        qr_url: qrUrl,
        device_code: deviceCode,
        send_to_feishu,
        sent_to_feishu: sentToFeishu,
        send_error: sendError,
      };
    }
    
    // 6. 验证凭证
    console.log('[feishu-qr-bind] 验证凭证...');
    const isValid = await validateAppCredentials(appId, appSecret);
    if (!isValid) {
      return {
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: '凭证验证失败',
        qr_path: qrPath,
        qr_url: qrUrl,
        device_code: deviceCode,
        send_to_feishu,
        sent_to_feishu: sentToFeishu,
        send_error: sendError,
      };
    }
    console.log('[feishu-qr-bind] 凭证验证通过');
    
    // 7. 保存配置
    if (save_config) {
      console.log('[feishu-qr-bind] 保存配置...');
      await saveConfig(appId, appSecret, authResult.domain);
    }
    
    // 8. 返回成功结果
    return {
      success: true,
      qr_path: qrPath,
      qr_url: qrUrl,
      device_code: deviceCode,
      app_id: appId,
      app_secret: appSecret,
      send_to_feishu,
      sent_to_feishu: sentToFeishu,
      send_error: sendError,
      message: save_config 
        ? '飞书机器人绑定成功，配置已保存' 
        : '飞书机器人绑定成功',
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
  description: '飞书机器人二维码绑定工具，通过 OAuth 设备授权流程完成绑定。支持生成二维码后自动通过飞书消息发送给用户。',
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
        description: '是否通过飞书消息发送二维码图片给用户',
        default: false,
      },
      user_open_id: {
        type: 'string',
        description: '接收者的飞书 open_id（send_to_feishu=true 时需要）',
      },
    },
  },
  handler: feishu_qr_bind,
};

export default feishu_qr_bind;
