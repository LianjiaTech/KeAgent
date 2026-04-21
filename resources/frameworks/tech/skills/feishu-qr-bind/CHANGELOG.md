# feishu-qr-bind 更新日志

## 2026-03-21 - 添加三大功能（参考 openakita）

### ✅ 新增功能

#### 1. 流式输出功能选择

**参数**: `interactive` (boolean, 默认 true)

**说明**: 控制是否显示交互式进度输出

**使用示例**:
```javascript
// 启用流式输出（默认）
await feishu_qr_bind({
  account_name: 'ceo',
  interactive: true,
});

// 输出：
// [Step 1] 初始化 OAuth 会话
// ══════════════════════════════════════════════════════════
// ⏳ 开始轮询...
// ✅ 凭证验证通过

// 静默模式
await feishu_qr_bind({
  account_name: 'ceo',
  interactive: false,
});

// 输出：只返回结果，不显示进度
```

---

#### 2. 群聊回复模式配置

**参数**: 
- `group_policy` (string, 默认 'open')
- `require_mention` (boolean, 默认 false)

**说明**: 配置机器人在群聊中的行为

**群聊策略选项**:
| 值 | 说明 | 适用场景 |
|-----|------|---------|
| `open` | ✅ 允许所有群聊 | 公开服务（默认） |
| `allowlist` | 只允许配置的群聊 | 企业内部 |
| `disabled` | 禁用群聊 | 仅私聊 |

**使用示例**:
```javascript
// 公开服务
await feishu_qr_bind({
  account_name: 'social',
  group_policy: 'open',
  require_mention: false,
});

// 企业白名单
await feishu_qr_bind({
  account_name: 'enterprise',
  group_policy: 'allowlist',
  require_mention: true,  // 需要 @机器人
});

// 仅私聊
await feishu_qr_bind({
  account_name: 'assistant',
  group_policy: 'disabled',
});
```

**保存的配置**:
```json
{
  "channels": {
    "feishu": {
      "accounts": {
        "social": {
          "groupPolicy": "open",
          "requireMention": false,
          "dmPolicy": "open"
        }
      }
    }
  }
}
```

---

#### 3. 支持自定义输入 appId 和 appSecret

**参数**: 
- `app_id` (string, 可选)
- `app_secret` (string, 可选)

**说明**: 支持手动输入凭证，跳过扫码流程

**使用示例**:
```javascript
// 模式 1: 手动输入凭证（跳过扫码）
await feishu_qr_bind({
  account_name: 'ceo',
  app_id: 'cli_a93cf8d6b53b9cd5',
  app_secret: 'j8PgtNlX6jHN1BxSfSjMVcsWDrP52rju',
  interactive: true,
});

// 输出：
// [Step 1] 使用已有凭证
// ℹ️  App ID: cli_a93cf8...
// ℹ️  App Secret: ********
// [Step 2] 验证凭证
// ✅ 凭证验证通过 ✅
// [Step 3] 保存配置
// ✅ 配置已保存到 [ceo] ✅

// 模式 2: Device Flow 扫码（不提供 app_id/app_secret）
await feishu_qr_bind({
  account_name: 'writer',
  // 不提供 app_id 和 app_secret，自动进入扫码模式
});
```

---

### 📋 完整参数列表

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `domain` | string | `'feishu'` | 飞书域名 (`feishu` \| `lark`) |
| `account_name` | string | `'ceo'` | 账户名称（agent 的 accountId） |
| **`app_id`** | string | - | **手动输入的 App ID** ✨ |
| **`app_secret`** | string | - | **手动输入的 App Secret** ✨ |
| **`group_policy`** | string | `'open'` | **群聊策略** ✨ |
| **`require_mention`** | boolean | `false` | **群聊是否需要 @** ✨ |
| **`interactive`** | boolean | `true` | **流式输出** ✨ |
| `timeout` | number | `600` | 轮询超时时间（秒） |
| `save_config` | boolean | `true` | 是否保存配置 |
| `send_to_feishu` | boolean | `false` | 是否发送二维码到飞书 |
| `user_open_id` | string | - | 接收者 open_id |

---

### 🎯 使用场景

#### 场景 1: 首次绑定（扫码）
```javascript
await feishu_qr_bind({
  account_name: 'writer',
  send_to_feishu: true,
  user_open_id: 'ou_xxx',
  interactive: true,
});
```

#### 场景 2: 批量部署（手动凭证）
```javascript
const agents = [
  { name: 'ceo', appId: 'cli_xxx', appSecret: 'xxx' },
  { name: 'writer', appId: 'cli_yyy', appSecret: 'yyy' },
];

for (const agent of agents) {
  await feishu_qr_bind({
    account_name: agent.name,
    app_id: agent.appId,
    app_secret: agent.appSecret,
    interactive: false,
  });
}
```

#### 场景 3: 企业配置（群聊白名单）
```javascript
await feishu_qr_bind({
  account_name: 'enterprise',
  group_policy: 'allowlist',
  require_mention: true,
  interactive: true,
});
```

---

### 📊 配置结构对比

#### 更新前
```json
{
  "appId": "cli_xxx",
  "appSecret": "xxx",
  "domain": "feishu",
  "dmPolicy": "open"
}
```

#### 更新后
```json
{
  "appId": "cli_xxx",
  "appSecret": "xxx",
  "domain": "feishu",
  "dmPolicy": "open",
  "connectionMode": "websocket",
  "enabled": true,
  "groupPolicy": "open",        // ✨ 新增
  "requireMention": false       // ✨ 新增
}
```

---

### 🔧 代码变更

#### 1. saveConfig 函数签名
```javascript
// 更新前
async function saveConfig(appId, appSecret, domain, accountName)

// 更新后
async function saveConfig(appId, appSecret, domain, accountName, groupPolicy, requireMention)
```

#### 2. 主函数逻辑
```javascript
// 新增模式选择
if (app_id && app_secret) {
  // 模式 1: 手动输入凭证
  log.step(1, '使用已有凭证');
  const validation = await validateAppCredentials(app_id, app_secret);
  // ...
} else {
  // 模式 2: Device Flow 扫码
  log.step(1, '初始化 OAuth 会话');
  // ...
}
```

#### 3. 流式输出
```javascript
const log = {
  step: (step, title) => {
    if (interactive) {
      console.log(`\n[Step ${step}] ${title}`);
      console.log('═'.repeat(50));
    }
  },
  success: (msg) => { if (interactive) console.log(`✅ ${msg}`); },
  info: (msg) => { if (interactive) console.log(`ℹ️  ${msg}`); },
  warn: (msg) => { if (interactive) console.log(`⚠️  ${msg}`); },
  error: (msg) => { if (interactive) console.log(`❌ ${msg}`); },
};
```

---

### 📁 文件变更

- ✅ `feishu-qr-bind.js` - 主脚本已更新
- ✅ `feishu-qr-bind.js.bak` - 备份文件
- ✅ `feishu-wizard.js` - 独立向导脚本（可选使用）
- ✅ `README-WIZARD.md` - 向导文档

---

### ✅ 测试状态

- [x] 语法检查通过
- [ ] 手动凭证模式测试
- [ ] 群聊配置测试
- [ ] 流式输出测试

---

### 📝 参考资料

- [openakita/setup/wizard.py](https://github.com/openakita/openakita/tree/main/src/openakita/setup)
- [openakita/setup/feishu_onboard.py](https://github.com/openakita/openakita/tree/main/src/openakita/setup)
- [openclaw-lark/src/messaging/inbound/gate.js](https://github.com/openakita/openclaw-lark)
