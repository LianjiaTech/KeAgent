#!/usr/bin/env node
/**
 * 飞书机器人绑定工具 - 支持指定 agent
 * 
 * 用法：
 *   node bind-agent.js --agent tech --send-to-feishu
 */

import axios from 'axios';
import QRCode from 'qrcode';
import fs from 'fs-extra';
import FormData from 'form-data';
import path from 'path';
import { homedir } from 'os';

// 配置
const FEISHU_OAUTH_BASE = 'https://accounts.feishu.cn';
const CONFIG_PATH = path.join(homedir(), '.keagent', 'openclaw.json');

/**
 * 读取配置
 */
async function readConfig() {
  if (await fs.pathExists(CONFIG_PATH)) {
    return fs.readJson(CONFIG_PATH);
  }
  return { channels: { feishu: { defaultAccount: 'main', accounts: {} } } };
}

/**
 * 保存配置
 */
async function saveConfig(agentId, appId, appSecret, domain = 'feishu') {
  const config = await readConfig();
  
  // 备份
  await fs.copy(CONFIG_PATH, CONFIG_PATH + '.backup.' + Date.now());
  
  // 确保结构存在
  if (!config.channels) config.channels = {};
  if (!config.channels.feishu) {
    config.channels.feishu = { defaultAccount: 'main', accounts: {} };
  }
  
  // 保存凭证
  config.channels.feishu.accounts[agentId] = {
    appId,
    appSecret,
    domain,
    groupPolicy: 'open',
    requireMention: false,
    dmPolicy: 'pairing',
    connectionMode: 'websocket',
    enabled: true,
  };
  
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
  console.log('✅ 配置已保存到', CONFIG_PATH);
}

/**
 * 轮询获取凭证
 */
async function pollForResult(deviceCode, beginRes, timeout = 600) {
  const startTime = Date.now();
  const expireIn = (beginRes.expire_in || timeout) * 1000;
  let interval = (beginRes.interval || 5) * 1000;
  
  console.log('⏳ 等待用户扫码授权...');
  
  while (Date.now() - startTime < expireIn) {
    try {
      const pollRes = await axios.post(
        `${FEISHU_OAUTH_BASE}/oauth/v1/app/registration`,
        new URLSearchParams({
          action: 'poll',
          device_code: deviceCode,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        }
      );
      
      const data = pollRes.data;
      
      // 检查成功
      if (data.client_id && data.client_secret) {
        console.log('✅ 授权成功！');
        return {
          success: true,
          appId: data.client_id,
          appSecret: data.client_secret,
          domain: data.user_info?.tenant_brand === 'lark' ? 'lark' : 'feishu',
          userInfo: data.user_info,
        };
      }
      
      // 检查错误
      if (data.error) {
        if (data.error === 'authorization_pending') {
          // 继续等待
        } else if (data.error === 'slow_down') {
          interval += 5000;
          console.log('⏸  收到 slow_down，调整间隔为', interval / 1000, '秒');
        } else if (data.error === 'access_denied') {
          return { success: false, error: 'USER_CANCELLED' };
        } else if (data.error === 'expired_token') {
          return { success: false, error: 'EXPIRED' };
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
      
    } catch (err) {
      // 网络错误，继续轮询
      console.log('⚠️  轮询失败:', err.message, '继续等待...');
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  return { success: false, error: 'TIMEOUT' };
}

/**
 * 发送图片到飞书
 */
async function sendImageToFeishu(imagePath, userOpenId, qrUrl, userCode) {
  // 使用 ceo 账户发送
  const config = await readConfig();
  const account = config.channels?.feishu?.accounts?.['ceo'];
  
  if (!account?.appId || !account?.appSecret) {
    console.log('⚠️  未配置 ceo 账户凭证，跳过图片发送');
    return { success: false, error: 'NO_CEO_CREDENTIALS' };
  }
  
  // 获取 token
  const tokenRes = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    { app_id: account.appId, app_secret: account.appSecret },
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  const tenantToken = tokenRes.data.tenant_access_token;
  
  // 上传图片
  const form = new FormData();
  form.append('image_type', 'message');
  form.append('image', fs.createReadStream(imagePath));
  
  const uploadRes = await axios.post(
    'https://open.feishu.cn/open-apis/im/v1/images',
    form,
    { headers: { 'Authorization': 'Bearer ' + tenantToken, ...form.getHeaders() } }
  );
  
  const imageKey = uploadRes.data.data.image_key;
  
  // 发送图片消息
  await axios.post(
    'https://open.feishu.cn/open-apis/im/v1/messages',
    {
      receive_id: userOpenId,
      msg_type: 'image',
      content: JSON.stringify({ image_key: imageKey }),
    },
    {
      headers: { 'Authorization': 'Bearer ' + tenantToken, 'Content-Type': 'application/json' },
      params: { receive_id_type: 'open_id' },
    }
  );
  
  // 发送说明消息
  const textContent = `🦞 飞书绑定 - ${userOpenId.includes('tech') ? 'Tech' : userOpenId} Agent\n\n请扫描上方图片完成授权：\n\n1. 打开飞书 App\n2. 长按识别二维码\n3. 确认授权 OpenClaw\n\nuser_code: ${userCode}\n\n或直接访问：${qrUrl}\n\n⚠️ 注意：扫码后请等待系统自动保存凭证...`;
  
  await axios.post(
    'https://open.feishu.cn/open-apis/im/v1/messages',
    {
      receive_id: userOpenId,
      msg_type: 'text',
      content: JSON.stringify({ text: textContent }),
    },
    {
      headers: { 'Authorization': 'Bearer ' + tenantToken, 'Content-Type': 'application/json' },
      params: { receive_id_type: 'open_id' },
    }
  );
  
  return { success: true };
}

/**
 * 主函数
 */
async function bindAgent(agentId, sendToFeishu = false, userOpenId = null) {
  console.log('🚀 开始绑定', agentId, 'agent 到飞书...');
  
  // 1. 获取 device_code
  const beginRes = await axios.post(
    `${FEISHU_OAUTH_BASE}/oauth/v1/app/registration`,
    new URLSearchParams({
      action: 'begin',
      archetype: 'PersonalAgent',
      auth_method: 'client_secret',
      request_user_info: 'open_id',
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    }
  );
  
  const deviceCode = beginRes.data.device_code;
  const qrUrl = beginRes.data.verification_uri_complete || beginRes.data.qr_url;
  const userCode = qrUrl.split('user_code=')[1];
  
  console.log('✅ 获取到 device_code');
  console.log('📱 user_code:', userCode);
  
  // 2. 生成二维码
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const qrPath = path.join('/tmp/openclaw', `feishu_qr_${agentId}_${timestamp}.png`);
  await fs.ensureDir('/tmp/openclaw');
  await QRCode.toFile(qrPath, qrUrl, { width: 512, margin: 2 });
  console.log('✅ 二维码已生成:', qrPath);
  
  // 3. 发送到飞书（可选）
  if (sendToFeishu && userOpenId) {
    console.log('📤 发送图片到飞书...');
    await sendImageToFeishu(qrPath, userOpenId, qrUrl, userCode);
    console.log('✅ 图片已发送到飞书');
  }
  
  // 4. 显示二维码（如果没有发送到飞书）
  if (!sendToFeishu) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('请扫描二维码完成授权');
    console.log('二维码路径:', qrPath);
    console.log('二维码 URL:', qrUrl);
    console.log('═══════════════════════════════════════════════════════════\n');
  }
  
  // 5. 轮询获取凭证
  const result = await pollForResult(deviceCode, beginRes);
  
  if (!result.success) {
    console.log('❌ 绑定失败:', result.error);
    return result;
  }
  
  console.log('✅ App ID:', result.appId);
  console.log('✅ App Secret:', result.appSecret.substring(0, 20) + '...');
  
  // 6. 保存配置
  await saveConfig(agentId, result.appId, result.appSecret, result.domain);
  
  console.log('\n🎉', agentId, 'agent 绑定成功！');
  console.log('凭证已保存到 ~/.keagent/openclaw.json');
  
  return result;
}

// 解析命令行参数
const args = process.argv.slice(2);
const params = {
  agent: 'tech',
  sendToFeishu: false,
  userOpenId: null,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--agent' && args[i + 1]) {
    params.agent = args[++i];
  } else if (args[i] === '--send-to-feishu') {
    params.sendToFeishu = true;
  } else if (args[i] === '--user-open-id' && args[i + 1]) {
    params.userOpenId = args[++i];
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
飞书机器人绑定工具 - 绑定到指定 agent

用法：node bind-agent.js [选项]

选项:
  --agent <agentId>         要绑定的 agent ID（默认：tech）
  --send-to-feishu          通过飞书发送二维码
  --user-open-id <ou_xxx>   接收者 open_id（send-to-feishu 时需要）
  --help, -h                显示帮助

示例:
  node bind-agent.js --agent tech
  node bind-agent.js --agent tech --send-to-feishu --user-open-id ou_xxx
`);
    process.exit(0);
  }
}

// 执行绑定
bindAgent(params.agent, params.sendToFeishu, params.userOpenId)
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });
