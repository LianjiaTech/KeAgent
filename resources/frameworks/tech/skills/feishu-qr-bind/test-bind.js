#!/usr/bin/env node
/**
 * 飞书二维码绑定工具 - 测试脚本
 * 
 * 用法：
 *   node test-bind.js --send-to-feishu --user-open-id ou_xxx
 */

import { feishu_qr_bind } from './feishu-qr-bind.js';

// 解析命令行参数
const args = process.argv.slice(2);
const params = {
  domain: 'feishu',
  timeout: 600,
  save_config: true,
  send_to_feishu: false,
  user_open_id: null,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--domain' && args[i + 1]) {
    params.domain = args[++i];
  } else if (args[i] === '--timeout' && args[i + 1]) {
    params.timeout = parseInt(args[++i]);
  } else if (args[i] === '--send-to-feishu') {
    params.send_to_feishu = true;
  } else if (args[i] === '--user-open-id' && args[i + 1]) {
    params.user_open_id = args[++i];
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
飞书二维码绑定工具 - 测试脚本

用法：node test-bind.js [选项]

选项:
  --domain <feishu|lark>    飞书域名（默认：feishu）
  --timeout <秒>            轮询超时时间（默认：600）
  --send-to-feishu          通过飞书消息发送二维码
  --user-open-id <ou_xxx>   接收者 open_id（send_to_feishu 时需要）
  --help, -h                显示帮助信息

示例:
  node test-bind.js
  node test-bind.js --send-to-feishu --user-open-id ou_d6f374a3c5f7b1c0472ad5dd178e9441
`);
    process.exit(0);
  }
}

// 执行绑定
console.log('🚀 启动飞书二维码绑定工具...');
console.log('参数:', JSON.stringify(params, null, 2));
console.log('');

const result = await feishu_qr_bind(params);

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('绑定结果');
console.log('═══════════════════════════════════════════════════════════');

if (result.success) {
  console.log('✅ 绑定成功！');
  console.log(`App ID: ${result.app_id}`);
  console.log(`App Secret: ${result.app_secret.substring(0, 20)}...`);
  console.log(`域名：${result.domain || 'feishu'}`);
  if (result.sent_to_feishu) {
    console.log('✅ 二维码已通过飞书发送');
  }
} else {
  console.log('❌ 绑定失败');
  console.log(`错误码：${result.error}`);
  console.log(`错误信息：${result.message}`);
  if (result.qr_path) {
    console.log(`二维码路径：${result.qr_path}`);
  }
}

console.log('═══════════════════════════════════════════════════════════');

process.exit(result.success ? 0 : 1);
