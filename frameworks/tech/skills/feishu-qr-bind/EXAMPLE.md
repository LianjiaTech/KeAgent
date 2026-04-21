# 使用示例

本文档提供飞书二维码绑定技能的实际使用示例。

## 示例 1：在 OpenClaw 中使用

### 通过 MCP 调用

```javascript
// 在 OpenClaw 配置或插件中
import { feishu_qr_bind } from '@larksuite/openclaw-lark/skills/feishu-qr-bind';

// 调用绑定工具
const result = await feishu_qr_bind({
  domain: 'feishu',  // 或使用 'lark'
  timeout: 300,
  save_config: true,
});

if (result.success) {
  console.log('✅ 绑定成功！');
  console.log('📱 二维码已生成:', result.qr_path);
  console.log('🔑 App ID:', result.app_id);
  console.log('🔐 App Secret:', result.app_secret);
} else {
  console.error('❌ 绑定失败:', result.message);
  console.error('错误类型:', result.error);
}
```

### 预期输出

```
✅ 绑定成功！
📱 二维码已生成：/tmp/openclaw/feishu_qr_20260320_143052.png
🔑 App ID: cli_202603201430520001
🔐 App Secret: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

## 示例 2：命令行快速绑定

创建一个快速绑定脚本：

```bash
#!/usr/bin/env node
// save as: feishu-bind-quick.js

import { feishu_qr_bind } from '@larksuite/openclaw-lark/skills/feishu-qr-bind';

async function main() {
  console.log('🚀 开始飞书机器人绑定流程...\n');
  
  const result = await feishu_qr_bind({
    timeout: 600, // 10 分钟超时
  });
  
  if (result.success) {
    console.log('\n✅ 绑定成功！\n');
    console.log('📱 二维码路径:', result.qr_path);
    console.log('🔑 App ID:', result.app_id);
    console.log('🔐 App Secret:', '***' + result.app_secret.slice(-8)); // 隐藏大部分
    console.log('\n配置已保存到 ~/.keagent/config.yaml');
  } else {
    console.error('\n❌ 绑定失败\n');
    console.error('错误:', result.error);
    console.error('详情:', result.message);
    process.exit(1);
  }
}

main().catch(console.error);
```

使用方法：

```bash
node feishu-bind-quick.js
```

## 示例 3：自定义配置保存

如果不想自动保存配置，可以手动处理：

```javascript
import { feishu_qr_bind } from '@larksuite/openclaw-lark/skills/feishu-qr-bind';
import fs from 'fs-extra';
import path from 'path';

const result = await feishu_qr_bind({
  save_config: false, // 不自动保存
});

if (result.success) {
  // 手动保存到自定义位置
  const customConfig = {
    feishu: {
      appId: result.app_id,
      appSecret: result.app_secret,
      domain: 'feishu',
      createdAt: new Date().toISOString(),
    },
  };
  
  const configPath = path.join(process.cwd(), 'my-feishu-config.json');
  await fs.writeJson(configPath, customConfig, { spaces: 2 });
  
  console.log('配置已保存到:', configPath);
}
```

## 示例 4：批量绑定多个账号

```javascript
import { feishu_qr_bind } from '@larksuite/openclaw-lark/skills/feishu-qr-bind';

const accounts = [
  { name: '主账号', domain: 'feishu' },
  { name: '国际账号', domain: 'lark' },
];

async function bindAll() {
  const results = [];
  
  for (const account of accounts) {
    console.log(`\n正在绑定 ${account.name}...`);
    
    const result = await feishu_qr_bind({
      domain: account.domain,
      timeout: 300,
      save_config: false, // 手动管理多个配置
    });
    
    results.push({
      name: account.name,
      ...result,
    });
    
    if (result.success) {
      console.log(`✅ ${account.name} 绑定成功`);
    } else {
      console.error(`❌ ${account.name} 绑定失败: ${result.message}`);
    }
  }
  
  // 保存所有结果
  console.log('\n绑定结果汇总:');
  console.table(results.map(r => ({
    账号：r.name,
    状态：r.success ? '成功' : '失败',
    AppID: r.app_id || '-',
  })));
}

bindAll();
```

## 示例 5：带进度显示的绑定

```javascript
import { feishu_qr_bind } from '@larksuite/openclaw-lark/skills/feishu-qr-bind';

async function bindWithProgress() {
  console.log('📱 生成二维码中...\n');
  
  const result = await feishu_qr_bind({
    timeout: 300,
  });
  
  if (!result.success) {
    console.error('❌ 绑定失败:', result.message);
    return;
  }
  
  console.log('\n✅ 绑定成功！\n');
  console.log('详细信息:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`二维码路径：${result.qr_path}`);
  console.log(`授权链接：${result.qr_url}`);
  console.log(`设备代码：${result.device_code}`);
  console.log(`App ID:    ${result.app_id}`);
  console.log(`App Secret: ${'*'.repeat(result.app_secret.length)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n配置已自动保存到 ~/.keagent/config.yaml');
}

bindWithProgress();
```

## 示例 6：错误处理最佳实践

```javascript
import { feishu_qr_bind } from '@larksuite/openclaw-lark/skills/feishu-qr-bind';

async function safeBind() {
  try {
    const result = await feishu_qr_bind({
      timeout: 300,
    });
    
    if (!result.success) {
      // 根据错误类型处理
      switch (result.error) {
        case 'TIMEOUT':
          console.log('⏱️  授权超时，请重新生成二维码');
          console.log('提示：二维码有效期为 5 分钟');
          break;
          
        case 'USER_CANCELLED':
          console.log('❌ 用户取消了授权');
          console.log('提示：请确认后再扫码');
          break;
          
        case 'NETWORK_ERROR':
          console.log('🌐 网络错误，请检查连接');
          console.log('提示：需要访问 open.feishu.cn');
          break;
          
        case 'INIT_FAILED':
        case 'BEGIN_FAILED':
          console.log('🔧 API 调用失败');
          console.log('提示：检查飞书开放平台状态');
          break;
          
        default:
          console.log('⚠️  未知错误:', result.message);
      }
      
      return false;
    }
    
    console.log('✅ 绑定成功！');
    return true;
    
  } catch (err) {
    console.error('💥 意外错误:', err.message);
    return false;
  }
}

safeBind();
```

## 示例 7：验证绑定结果

```javascript
import { feishu_qr_bind } from '@larksuite/openclaw-lark/skills/feishu-qr-bind';
import axios from 'axios';

async function bindAndVerify() {
  console.log('📱 开始绑定流程...\n');
  
  const result = await feishu_qr_bind({
    save_config: true,
  });
  
  if (!result.success) {
    console.error('❌ 绑定失败:', result.message);
    return;
  }
  
  console.log('✅ 绑定成功！\n');
  console.log('🔍 正在验证凭证...\n');
  
  // 验证 appId/appSecret 是否有效
  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
      {
        app_id: result.app_id,
        app_secret: result.app_secret,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    if (response.data.code === 0) {
      console.log('✅ 凭证验证成功！');
      console.log('🎫 access_token:', response.data.app_access_token?.slice(0, 20) + '...');
    } else {
      console.warn('⚠️  凭证验证失败:', response.data.msg);
    }
  } catch (err) {
    console.error('❌ 验证请求失败:', err.message);
  }
}

bindAndVerify();
```

## 示例 8：在 CI/CD 中使用

```yaml
# .github/workflows/feishu-bind.yml
name: Feishu Bot Binding

on:
  workflow_dispatch:
    inputs:
      domain:
        description: 'Feishu domain (feishu or lark)'
        required: true
        default: 'feishu'

jobs:
  bind:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Bind Feishu Bot
        run: |
          node -e "
            import { feishu_qr_bind } from './skills/feishu-qr-bind/index.js';
            
            (async () => {
              const result = await feishu_qr_bind({
                domain: '${{ github.event.inputs.domain }}',
                save_config: false,
              });
              
              if (result.success) {
                console.log('::set-output name=app_id::' + result.app_id);
                console.log('::set-output name=app_secret::' + result.app_secret);
                console.log('✅ Binding successful');
              } else {
                console.error('❌ Binding failed:', result.message);
                process.exit(1);
              }
            })();
          "
        id: bind
```

## 调试技巧

### 1. 启用详细日志

```javascript
import { feishu_qr_bind } from '@larksuite/openclaw-lark/skills/feishu-qr-bind';

// 临时启用调试模式
process.env.DEBUG = 'feishu-qr-bind:*';

const result = await feishu_qr_bind({
  timeout: 300,
});
```

### 2. 检查生成的文件

```bash
# 查看二维码文件
ls -lh /tmp/openclaw/feishu_qr_*.png

# 查看配置文件
cat ~/.keagent/config.yaml

# 查看备份文件
ls -lh ~/.keagent/config.yaml.backup.*
```

### 3. 测试网络连接

```bash
# 测试飞书 API 连通性
curl -I https://open.feishu.cn/oauth/v1/app/registration

# 国际版
curl -I https://open.larksuite.com/oauth/v1/app/registration
```

### 4. 查看 OpenClaw 日志

```bash
# 实时查看日志
tail -f ~/.keagent/logs/openclaw.log

# 搜索绑定相关日志
grep "feishu-qr-bind" ~/.keagent/logs/openclaw.log
```

## 常见问题

### Q: 二维码扫描后没反应？

A: 
1. 检查网络连接
2. 确认二维码未过期（5 分钟有效期）
3. 重新生成二维码
4. 检查飞书账号权限

### Q: 如何切换飞书域名？

A: 
```javascript
// 明确指定域名
await feishu_qr_bind({ domain: 'lark' });
```

### Q: 配置保存到哪里了？

A: 
默认保存到 `~/.keagent/config.yaml`

### Q: 如何查看已保存的配置？

A: 
```bash
cat ~/.keagent/config.yaml | grep -A 5 "feishu:"
```

### Q: 可以手动设置 appId/appSecret 吗？

A: 
可以，编辑 `~/.keagent/config.yaml`:
```yaml
feishu:
  appId: 'cli_xxxxxxxx'
  appSecret: 'xxxxxxxx'
  domain: 'feishu'
```

## 更多资源

- [技能文档](./SKILL.md) - 完整的 API 文档
- [README](./README.md) - 使用说明
- [测试文件](./test/) - 单元测试示例
- [飞书开放平台](https://open.feishu.cn/) - 官方文档
