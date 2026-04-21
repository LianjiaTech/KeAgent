# 飞书 OAuth Device Flow 分析与 feishu-qr-bind Skill 修复方案

## 1. 插件架构分析

### 1.1 @larksuite/openclaw-lark-tools 插件结构

```
/home/ubuntu/.npm-global/lib/node_modules/@larksuite/openclaw-lark-tools/
├── package.json              # 包配置
├── dist/
│   ├── index.js              # CLI 入口
│   ├── commands/
│   │   ├── install.js        # 安装命令（包含 OAuth 流程）
│   │   ├── info.js
│   │   ├── doctor.js
│   │   ├── update.js
│   │   └── self-update.js
│   └── utils/
│       ├── feishu-auth.js    # OAuth 认证核心逻辑 ⭐
│       ├── install-prompts.js # 交互式安装流程 ⭐
│       ├── config.js         # 配置读写
│       ├── constants.js      # 常量定义
│       ├── migration.js      # 配置迁移
│       ├── prompts.js        # 通用提示
│       └── system.js         # 系统命令
```

### 1.2 核心模块职责

#### feishu-auth.js
- **FeishuAuth 类**: 封装 OAuth API 调用
  - `init()`: 初始化授权会话
  - `begin()`: 开始授权，获取 device_code
  - `poll(deviceCode)`: 轮询授权状态
  - `setDomain(isLark)`: 切换飞书/飞书国际域名
  - `printQRCode(url)`: 打印终端二维码

- **validateAppCredentials()**: 验证 appId/appSecret 有效性

#### install-prompts.js
- **runInstallAuthFlow()**: 完整的交互式安装流程
  - 检测现有配置
  - 用户确认是否使用现有配置
  - 处理新安装（handleNewInstallation）
  - 处理现有安装（handleExistingInstallation）
  - 手动输入凭证（promptAndValidateCredentials）

#### install.js
- **installCommand()**: 主安装命令
  - 版本检查
  - 插件安装
  - 配置渠道（调用 ensureChannelConfig）
  - 验证并启动网关

---

## 2. OAuth Device Flow 详细流程

### 2.1 标准流程（基于源码分析）

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INIT - 初始化授权会话                                      │
├─────────────────────────────────────────────────────────────┤
│ POST https://open.feishu.cn/oauth/v1/app/registration       │
│      ?action=init                                           │
│                                                             │
│ Response:                                                   │
│ {                                                           │
│   "supported_auth_methods": ["client_secret"],              │
│   "archetypes": ["PersonalAgent"]                           │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. BEGIN - 开始授权，获取 device_code                          │
├─────────────────────────────────────────────────────────────┤
│ POST https://open.feishu.cn/oauth/v1/app/registration       │
│      ?action=begin                                          │
│      &archetype=PersonalAgent                               │
│      &auth_method=client_secret                             │
│      &request_user_info=open_id                             │
│                                                             │
│ Response:                                                   │
│ {                                                           │
│   "device_code": "device_code_xxxxxxxxxxxx",                │
│   "verification_uri_complete": "https://...",               │
│   "qr_url": "https://...",                                  │
│   "interval": 5,          // 轮询间隔（秒）                  │
│   "expire_in": 600,       // 过期时间（秒）                  │
│   "user_info": {                                          │
│     "tenant_brand": "feishu" | "lark"  // 用于域名切换      │
│   }                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 生成二维码并展示给用户                                     │
│ - 使用 verification_uri_complete 作为二维码内容              │
│ - 用户在飞书中扫描二维码                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. POLL - 轮询授权状态                                        │
├─────────────────────────────────────────────────────────────┤
│ POST https://open.feishu.cn/oauth/v1/app/registration       │
│      ?action=poll                                           │
│      &device_code={device_code}                             │
│                                                             │
│ 轮询逻辑（install-prompts.js）:                              │
│ - 使用 begin 返回 interval（默认 5 秒）                        │
│ - 检测 slow_down 错误，增加间隔                              │
│ - 总超时时间：expire_in（默认 600 秒=10 分钟）                 │
│                                                             │
│ 可能的 Response:                                            │
│                                                             │
│ (a) 授权成功:                                               │
│ {                                                           │
│   "client_id": "cli_xxxxxxxxxxxxxxxx",                      │
│   "client_secret": "xxxxxxxxxxxxxxxx",                      │
│   "user_info": {                                            │
│     "open_id": "ou_xxxxxxxxxxxx",                           │
│     "tenant_brand": "feishu" | "lark"                       │
│   }                                                         │
│ }                                                           │
│                                                             │
│ (b) 等待中:                                                 │
│ { "error": "authorization_pending" }                        │
│                                                             │
│ (c) 需要慢下来:                                             │
│ { "error": "slow_down" }                                    │
│                                                             │
│ (d) 用户拒绝:                                               │
│ { "error": "access_denied" }                                │
│                                                             │
│ (e) 过期:                                                   │
│ { "error": "expired_token" }                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 保存配置                                                   │
├─────────────────────────────────────────────────────────────┤
│ 保存到 ~/.keagent/openclaw.json:                           │
│ {                                                           │
│   "channels": {                                             │
│     "feishu": {                                             │
│       "defaultAccount": "main",                             │
│       "accounts": {                                         │
│         "main": {                                           │
│           "appId": "cli_xxx",                               │
│           "appSecret": "xxx",                               │
│           "domain": "feishu",                               │
│           ...                                               │
│         }                                                   │
│       }                                                     │
│     }                                                       │
│   }                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 关键发现

1. **域名自动切换**: 
   - 通过 `user_info.tenant_brand` 判断是飞书还是飞书国际
   - 使用 `auth.setDomain(isLark)` 切换 API 域名
   - 切换后需要重新 poll

2. **轮询间隔**:
   - 使用 begin 返回的 `interval` 字段（不是固定 3 秒）
   - 遇到 `slow_down` 错误时增加 5 秒
   - 官方推荐间隔是 5 秒

3. **超时时间**:
   - 使用 begin 返回的 `expire_in` 字段（默认 600 秒=10 分钟）
   - 现有 skill 使用 300 秒（5 分钟），偏保守

4. **成功响应字段**:
   - `client_id` 和 `client_secret`（不是 `app_id`/`app_secret`）
   - 包含完整的 `user_info` 对象

---

## 3. 现有 feishu-qr-bind Skill 问题分析

### 3.1 主要问题

#### 问题 1: 轮询逻辑错误 ⚠️
**位置**: `feishu-qr-bind.js` - `waitForAuthorization()`

```javascript
// ❌ 错误：使用固定状态检查
const status = result.data?.status;

if (status === 'confirmed') {
  return { success: true, ... };
} else if (status === 'expired' || status === 'cancelled') {
  return { success: false, ... };
}
```

**问题**: 
- 飞书 OAuth API **不返回** `status` 字段
- 应该检查 `client_id` 和 `client_secret` 是否存在
- 错误处理应该基于 `error` 字段

**正确做法**（参考 install-prompts.js）:
```javascript
// ✅ 正确：检查凭证字段
if (pollRes.client_id && pollRes.client_secret) {
  return { success: true, appId: pollRes.client_id, ... };
}

// ✅ 正确：基于 error 字段处理
if (pollRes.error) {
  if (pollRes.error === 'authorization_pending') {
    // 继续等待
  } else if (pollRes.error === 'slow_down') {
    // 增加间隔
  } else if (pollRes.error === 'access_denied') {
    // 用户拒绝
  } else if (pollRes.error === 'expired_token') {
    // 过期
  }
}
```

#### 问题 2: 轮询间隔不合理 ⚠️
**位置**: `feishu-qr-bind.js` - `CONFIG`

```javascript
const CONFIG = {
  pollInterval: 3000, // ❌ 固定 3 秒，应该使用 API 返回的 interval
  defaultTimeout: 300, // ❌ 固定 300 秒，应该使用 expire_in
};
```

**问题**:
- 不尊重 API 返回的 `interval` 建议
- 可能导致 `slow_down` 错误
- 超时时间过短（5 分钟 vs 官方 10 分钟）

#### 问题 3: 缺少域名自动切换 ⚠️
**位置**: `feishu-qr-bind.js` - 整个文件

**问题**:
- 没有实现域名自动切换逻辑
- 如果用户是飞书国际版（lark），会失败
- 应该检查 `user_info.tenant_brand` 并切换

#### 问题 4: 配置读取逻辑复杂且易错 ⚠️
**位置**: `feishu-qr-bind.js` - `readConfig()`

**问题**:
- 同时处理 JSON 和 YAML 格式，逻辑复杂
- YAML 解析使用字符串匹配，容易出错
- 应该优先使用 openclaw.json（新格式）

#### 问题 5: 配置保存逻辑冗余
**位置**: `feishu-qr-bind.js` - `saveConfig()`

**问题**:
- 保存逻辑过于复杂，重复代码多
- 应该简化为只处理 openclaw.json
- YAML 支持可以移除（已过时）

#### 问题 6: 缺少凭证验证
**位置**: 整个流程

**问题**:
- 获取到 appId/appSecret 后没有验证
- 应该调用 `validateAppCredentials()` 验证
- 避免保存无效凭证

#### 问题 7: send_to_feishu 功能实现不完整
**位置**: `feishu-qr-bind.js` - `sendImageToFeishu()`

**问题**:
- 图片上传逻辑有问题（使用错误的 API）
- 应该使用飞书开放平台的图片上传 API
- 需要正确的 tenant_access_token

### 3.2 次要问题

1. **错误处理不统一**: 有些地方返回对象，有些 throw error
2. **日志输出过多**: 生产环境应该减少 console.log
3. **缺少重试机制**: 网络错误应该自动重试
4. **没有进度提示**: 长时间轮询没有用户反馈

---

## 4. 修复方案

### 4.1 总体策略

基于 @larksuite/openclaw-lark-tools 插件的实现，重构 feishu-qr-bind skill：

1. **复用官方逻辑**: 直接使用 FeishuAuth 类
2. **简化配置管理**: 只处理 openclaw.json
3. **完整错误处理**: 覆盖所有 OAuth 错误场景
4. **添加域名切换**: 支持飞书中国和飞书国际

### 4.2 修复后的实现方案

#### 方案 A: 直接调用官方库（推荐）⭐

```javascript
// feishu-qr-bind.js (重构版)
import { FeishuAuth, validateAppCredentials } from '@larksuite/openclaw-lark-tools/dist/utils/feishu-auth.js';
import QRCode from 'qrcode';
import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';

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
    const auth = new FeishuAuth({
      env: domain === 'lark' ? 'lark' : 'prod',
      debug: false,
    });
    
    // 2. 初始化
    await auth.init();
    
    // 3. 开始授权
    const beginRes = await auth.begin();
    const deviceCode = beginRes.device_code;
    const qrUrl = beginRes.verification_uri_complete;
    
    // 4. 生成二维码
    const qrPath = await generateQRCode(qrUrl);
    
    // 5. 轮询等待
    const result = await pollForResult(auth, deviceCode, beginRes);
    
    if (!result.success) {
      return formatError(result, qrPath, qrUrl, deviceCode);
    }
    
    // 6. 验证凭证
    const isValid = await validateAppCredentials(result.appId, result.appSecret);
    if (!isValid) {
      throw new Error('凭证验证失败');
    }
    
    // 7. 保存配置
    if (save_config) {
      await saveConfig(result.appId, result.appSecret, result.domain);
    }
    
    // 8. 返回结果
    return {
      success: true,
      qr_path: qrPath,
      qr_url: qrUrl,
      device_code: deviceCode,
      app_id: result.appId,
      app_secret: result.appSecret,
      message: '飞书机器人绑定成功，配置已保存',
    };
    
  } catch (err) {
    return {
      success: false,
      error: 'UNEXPECTED_ERROR',
      message: `绑定失败：${err.message}`,
    };
  }
}

async function pollForResult(auth, deviceCode, beginRes) {
  const startTime = Date.now();
  const expireIn = (beginRes.expire_in || 600) * 1000;
  let interval = (beginRes.interval || 5) * 1000;
  let isLark = false;
  
  while (Date.now() - startTime < expireIn) {
    const pollRes = await auth.poll(deviceCode);
    
    // 检查域名切换
    if (pollRes.user_info?.tenant_brand === 'lark' && !isLark) {
      auth.setDomain(true);
      isLark = true;
      continue;
    }
    
    // 检查成功
    if (pollRes.client_id && pollRes.client_secret) {
      return {
        success: true,
        appId: pollRes.client_id,
        appSecret: pollRes.client_secret,
        domain: isLark ? 'lark' : 'feishu',
      };
    }
    
    // 检查错误
    if (pollRes.error) {
      if (pollRes.error === 'authorization_pending') {
        // 继续等待
      } else if (pollRes.error === 'slow_down') {
        interval += 5000;
      } else if (pollRes.error === 'access_denied') {
        return { success: false, error: 'USER_CANCELLED' };
      } else if (pollRes.error === 'expired_token') {
        return { success: false, error: 'EXPIRED' };
      } else {
        return { success: false, error: pollRes.error };
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  return { success: false, error: 'TIMEOUT' };
}
```

#### 方案 B: 完全重写（备选）

如果方案 A 不可行（依赖问题），则完全重写，参考 install-prompts.js 的逻辑。

### 4.3 配置管理简化

```javascript
// 只处理 openclaw.json
async function readConfig() {
  const configPath = path.join(homedir(), '.keagent', 'openclaw.json');
  const content = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(content);
}

async function saveConfig(appId, appSecret, domain = 'feishu') {
  const configPath = path.join(homedir(), '.keagent', 'openclaw.json');
  const config = await readConfig();
  
  // 备份
  await fs.writeFile(`${configPath}.backup.${Date.now()}`, 
                     JSON.stringify(config, null, 2));
  
  // 更新
  if (!config.channels) config.channels = {};
  if (!config.channels.feishu) {
    config.channels.feishu = { defaultAccount: 'main', accounts: {} };
  }
  
  const accountName = config.channels.feishu.defaultAccount || 'main';
  config.channels.feishu.accounts[accountName] = {
    ...config.channels.feishu.accounts[accountName],
    appId,
    appSecret,
    domain,
  };
  
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}
```

### 4.4 二维码发送功能修复

```javascript
async function sendImageToFeishu(imagePath, userOpenId) {
  try {
    const config = await readConfig();
    const appId = config.channels?.feishu?.accounts?.main?.appId;
    const appSecret = config.channels?.feishu?.accounts?.main?.appSecret;
    
    if (!appId || !appSecret) {
      return { success: false, error: 'NO_BOT_CREDENTIALS' };
    }
    
    // 获取 tenant_access_token
    const tokenRes = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      { app_id: appId, app_secret: appSecret }
    );
    const tenantToken = tokenRes.data.tenant_access_token;
    
    // 上传图片
    const imageBuffer = await fs.readFile(imagePath);
    const formData = new FormData();
    formData.append('image', imageBuffer);
    
    const uploadRes = await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/images',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    const imageKey = uploadRes.data.data.image_key;
    
    // 发送图片消息
    const sendRes = await axios.post(
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
      }
    );
    
    return { success: true, message_id: sendRes.data.data.message_id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

---

## 5. 实施计划

### 5.1 第一阶段：核心修复（1-2 小时）

1. **备份现有代码**
   ```bash
   cp -r skills/feishu-qr-bind skills/feishu-qr-bind.backup
   ```

2. **重写 feishu-qr-bind.js**
   - 使用 FeishuAuth 类（如果可以 import）
   - 或完全参考 install-prompts.js 逻辑
   - 修复轮询逻辑
   - 添加域名切换
   - 简化配置管理

3. **测试核心流程**
   ```bash
   node --test test/*.test.js
   ```

### 5.2 第二阶段：功能完善（1 小时）

1. **修复 send_to_feishu 功能**
   - 使用正确的飞书 API
   - 添加错误处理

2. **添加凭证验证**
   - 调用 validateAppCredentials()
   - 验证失败时提示用户

3. **优化用户体验**
   - 添加进度提示
   - 减少不必要的日志
   - 添加重试机制

### 5.3 第三阶段：文档更新（30 分钟）

1. **更新 SKILL.md**
   - 修正 API 文档
   - 更新示例代码

2. **更新 README.md**
   - 修复使用说明
   - 添加故障排查

3. **更新 EXAMPLE.md**
   - 添加新示例
   - 修正错误示例

### 5.4 第四阶段：测试验证（30 分钟）

1. **单元测试**
   - 二维码生成测试
   - 配置读写测试

2. **集成测试**（可选）
   - 完整流程测试（需要真实飞书账号）

3. **文档验证**
   - 确保文档与代码一致

---

## 6. 测试策略

### 6.1 单元测试

```javascript
// test/qr-generation.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import QRCode from 'qrcode';

test('QR Code 生成', async () => {
  const url = 'https://open.feishu.cn/oauth/v1/app/registration?device_code=test';
  const outputPath = '/tmp/test_qr.png';
  
  await QRCode.toFile(outputPath, url, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  
  const exists = await fs.pathExists(outputPath);
  assert.ok(exists, '二维码文件应该存在');
});
```

### 6.2 集成测试（手动）

```bash
# 测试完整流程
node feishu-qr-bind-cli.js --timeout 60 --save-config false

# 预期输出:
# - 生成二维码
# - 等待扫码
# - 返回 appId/appSecret
```

---

## 7. 风险评估

### 7.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| FeishuAuth 无法 import | 中 | 中 | 使用方案 B 完全重写 |
| 飞书 API 变更 | 低 | 高 | 添加版本检测 |
| 配置格式不兼容 | 低 | 中 | 添加配置迁移 |

### 7.2 回滚方案

如果修复失败：
```bash
# 恢复备份
rm -rf skills/feishu-qr-bind
mv skills/feishu-qr-bind.backup skills/feishu-qr-bind

# 使用官方 install 命令
feishu-plugin-onboard install --use-existing
```

---

## 8. 总结

### 8.1 核心发现

1. **现有 skill 的轮询逻辑完全错误** - 这是最严重的问题
2. **应该复用官方插件代码** - FeishuAuth 类已经实现得很好
3. **配置管理应该简化** - 只处理 openclaw.json
4. **需要添加域名切换** - 支持飞书国际版

### 8.2 修复优先级

1. **P0**: 修复轮询逻辑（必须）
2. **P0**: 添加域名切换（必须）
3. **P1**: 简化配置管理（重要）
4. **P1**: 添加凭证验证（重要）
5. **P2**: 修复 send_to_feishu（可选）
6. **P2**: 优化用户体验（可选）

### 8.3 预期结果

修复后的 skill 应该：
- ✅ 正确实现 OAuth Device Flow
- ✅ 支持飞书中国和飞书国际
- ✅ 自动切换域名
- ✅ 正确的轮询间隔和超时
- ✅ 完整的错误处理
- ✅ 简化的配置管理
- ✅ 可选的二维码消息发送

---

## 附录 A: 关键代码对比

### A.1 轮询逻辑对比

**现有实现（错误）**:
```javascript
const status = result.data?.status;
if (status === 'confirmed') { ... }
```

**官方实现（正确）**:
```javascript
if (pollRes.client_id && pollRes.client_secret) {
  // 成功
}
if (pollRes.error === 'authorization_pending') {
  // 继续等待
}
```

### A.2 配置格式对比

**旧格式（config.yaml）**:
```yaml
feishu:
  appId: 'cli_xxx'
  appSecret: 'xxx'
```

**新格式（openclaw.json）**:
```json
{
  "channels": {
    "feishu": {
      "defaultAccount": "main",
      "accounts": {
        "main": {
          "appId": "cli_xxx",
          "appSecret": "xxx",
          "domain": "feishu"
        }
      }
    }
  }
}
```

---

## 附录 B: 参考资源

- 官方插件源码：`/home/ubuntu/.npm-global/lib/node_modules/@larksuite/openclaw-lark-tools/`
- 现有 skill: `/home/ubuntu/.keagent/workspace-tech/skills/feishu-qr-bind/`
- 飞书 OAuth 文档：https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/oauth2/oauth-code

---

**文档版本**: 1.0  
**创建时间**: 2026-03-20  
**作者**: OpenClaw Tech Agent
