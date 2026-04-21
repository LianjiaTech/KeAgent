#!/usr/bin/env node
/**
 * 飞书二维码绑定 CLI 入口
 */

import { feishu_qr_bind } from './feishu-qr-bind.js';

// 从命令行参数解析参数
const args = process.argv.slice(2);
const params = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--domain' && args[i + 1]) {
    params.domain = args[++i];
  } else if (arg === '--timeout' && args[i + 1]) {
    params.timeout = parseInt(args[++i], 10);
  } else if (arg === '--save-config') {
    params.save_config = true;
  } else if (arg === '--no-save-config') {
    params.save_config = false;
  } else if (arg === '--send-to-feishu') {
    params.send_to_feishu = true;
  } else if (arg === '--user-open-id' && args[i + 1]) {
    params.user_open_id = args[++i];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
飞书机器人二维码绑定工具

用法：node feishu-qr-bind-cli.js [选项]

选项:
  --domain <feishu|lark>   飞书域名 (默认：feishu)
  --timeout <秒>           超时时间 (默认：300)
  --save-config            保存配置到 OpenClaw (默认：true)
  --no-save-config         不保存配置
  --send-to-feishu         发送二维码到飞书消息
  --user-open-id <ou_xxx>  接收者的飞书 open_id
  --help, -h               显示帮助

示例:
  node feishu-qr-bind-cli.js --send-to-feishu --user-open-id ou_xxxxxx
`);
    process.exit(0);
  }
}

// 执行绑定
(async () => {
  try {
    console.log('开始飞书机器人绑定流程...');
    console.log('参数:', JSON.stringify(params, null, 2));
    console.log('');
    
    const result = await feishu_qr_bind(params);
    
    console.log('\n=== 绑定结果 ===');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ 飞书机器人绑定成功!');
      if (result.app_id) {
        console.log(`App ID: ${result.app_id}`);
      }
      if (result.qr_path) {
        console.log(`二维码路径：${result.qr_path}`);
      }
      if (result.qr_url) {
        console.log(`二维码 URL: ${result.qr_url}`);
      }
    } else {
      console.log('\n❌ 绑定失败:', result.error || result.message);
      if (result.qr_url) {
        console.log(`\n二维码 URL: ${result.qr_url}`);
        console.log('请在飞书中扫描此二维码或访问此 URL 完成授权');
      }
      process.exit(1);
    }
  } catch (err) {
    console.error('错误:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
