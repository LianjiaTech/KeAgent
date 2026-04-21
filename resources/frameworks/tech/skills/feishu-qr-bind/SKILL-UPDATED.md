---
name: feishu_qr_bind
description: |
  飞书机器人二维码绑定工具（参考 openakita + 官方插件）。
  支持扫码授权或手动输入凭证，可配置群聊回复模式，支持流式输出。
  通过 OAuth 设备授权流程生成二维码图片，完成飞书机器人与 OpenClaw 的绑定。
---

# feishu_qr_bind

飞书机器人二维码绑定技能（增强版）。实现完整的 OAuth 设备授权流程，支持两种绑定模式，可配置群聊策略。

## 功能特性

✅ **参考实现**
- [openakita/setup/wizard.py](https://github.com/openakita/openakita/tree/main/src/openakita/setup) - 交互式向导
- [openakita/setup/feishu_onboard.py](https://github.com/openakita/openakita/tree/main/src/openakita/setup) - Device Flow
- [openclaw-lark/src/messaging/inbound/gate.js](https://github.com/openakita/openclaw-lark) - dmPolicy 配置

✅ **核心功能**
1. **模式 1: 手动输入凭证** - 适合已有 appId/appSecret，跳过扫码
2. **模式 2: Device Flow 扫码** - 自动创建飞书应用
3. **群聊回复模式配置** - groupPolicy 设置（open | allowlist | disabled）
4. **流式输出** - 交互式进度显示（interactive 参数）
5. **自动 dmPolicy: 'open'** - 无需配对，用户可直接发消息

## 工作原理

### Device Flow 流程（参考 openakita）

```
1. init   → POST /oauth/v1/app/registration?action=init
2. begin  → POST /oauth/v1/app/registration?action=begin → 返回 device_code + verification_uri
3. poll   → POST /oauth/v1/app/registration?action=poll → 轮询授权状态
4. 成功   → 获取 client_id + client_secret
5. 验证   → 通过 tenant_access_token API 验证凭证
6. 保存   → 写入 OpenClaw 配置（含 dmPolicy, groupPolicy 等）
```

**API 端点**：
- 飞书中国：`https://accounts.feishu.cn/oauth/v1/app/registration`
- 飞书国际：`https://accounts.larksuite.com/oauth/v1/app/registration`

## 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `domain` | string | `'feishu'` | 飞书域名 (`feishu` \| `lark`) |
| `account_name` | string | `'ceo'` | 账户名称（agent 的 accountId） |
| `app_id` | string | - | **手动输入的 App ID**（跳过扫码） |
| `app_secret` | string | - | **手动输入的 App Secret**（跳过扫码） |
| `group_policy` | string | `'open'` | **群聊策略** (`open` \| `allowlist` \| `disabled`) |
| `require_mention` | boolean | `false` | **群聊是否需要 @机器人** |
| `interactive` | boolean | `true` | **是否启用交互式输出（流式）** |
| `timeout` | number | `600` | 轮询超时时间（秒） |
| `save_config` | boolean | `true` | 是否保存配置 |
| `send_to_feishu` | boolean | `false` | 是否发送二维码到飞书 |
| `user_open_id` | string | - | 接收者 open_id |

## 使用示例

### 示例 1: 扫码授权（默认）

```javascript
const result = await feishu_qr_bind({
  domain: 'feishu',
  account_name: 'writer',
  send_to_feishu: true,
  user_open_id: 'ou_d6f374a3c5f7b1c0472ad5dd178e9441',
  interactive: true,
});
```

**流式输出**：
```
🚀 开始绑定 writer 助手

[Step 1] 初始化 OAuth 会话
══════════════════════════════════════════════════

[Step 2] 启动 Device Flow
══════════════════════════════════════════════════
ℹ️  Device Code: v1:eyJhbGci...
ℹ️  QR URL: https://open.feishu.cn/page/openclaw?user_code=XXX

[Step 3] 生成二维码
══════════════════════════════════════════════════
✅ 二维码已保存：/tmp/openclaw/feishu_qr_2026-03-21T1014.png

[Step 4] 发送二维码到飞书
══════════════════════════════════════════════════
✅ 二维码已发送到飞书 ✅

[Step 5] 等待授权
══════════════════════════════════════════════════
⏳ 开始轮询...
✅ 授权成功（尝试 3 次）

[Step 6] 验证凭证
══════════════════════════════════════════════════
✅ 凭证验证通过 ✅

[Step 7] 保存配置
══════════════════════════════════════════════════
✅ 配置已保存到账户 [writer] ✅

[Step 8] 完成
══════════════════════════════════════════════════
✅ 飞书机器人绑定完成！🎉
```

### 示例 2: 手动输入凭证

```javascript
const result = await feishu_qr_bind({
  account_name: 'ceo',
  app_id: 'cli_a93cf8d6b53b9cd5',
  app_secret: 'j8PgtNlX6jHN1BxSfSjMVcsWDrP52rju',
  interactive: true,
});
```

**输出**：
```
[Step 1] 使用已有凭证
══════════════════════════════════════════════════
ℹ️  App ID: cli_a93cf8...
ℹ️  App Secret: ********

[Step 2] 验证凭证
══════════════════════════════════════════════════
✅ 凭证验证通过 ✅

[Step 3] 保存配置
══════════════════════════════════════════════════
✅ 配置已保存到 [ceo] ✅
```

### 示例 3: 配置群聊模式

```javascript
// 企业白名单
const result = await feishu_qr_bind({
  account_name: 'enterprise',
  group_policy: 'allowlist',
  require_mention: true,
});

// 公开服务
const result = await feishu_qr_bind({
  account_name: 'social',
  group_policy: 'open',
  require_mention: false,
});

// 仅私聊
const result = await feishu_qr_bind({
  account_name: 'assistant',
  group_policy: 'disabled',
});
```

### 示例 4: 批量部署（静默模式）

```javascript
const agents = [
  { name: 'ceo', appId: 'cli_xxx', appSecret: 'xxx' },
  { name: 'writer', appId: 'cli_yyy', appSecret: 'yyy' },
];

for (const agent of agents) {
  const result = await feishu_qr_bind({
    account_name: agent.name,
    app_id: agent.appId,
    app_secret: agent.appSecret,
    interactive: false,  // 静默模式
  });
}
```

## 返回值

### 成功

```json
{
  "success": true,
  "qr_path": "/tmp/openclaw/feishu_qr_2026-03-21T1014.png",
  "qr_url": "https://open.feishu.cn/page/openclaw?user_code=XXX",
  "device_code": "v1:eyJhbGci...",
  "app_id": "cli_a934a108bab89bd3",
  "app_secret": "xxxxx",
  "account_name": "writer",
  "send_to_feishu": true,
  "sent_to_feishu": true,
  "send_error": null,
  "group_policy": "open",
  "require_mention": false,
  "message": "飞书机器人绑定成功！配置已保存到账户 [writer]（dmPolicy: open，无需配对）"
}
```

### 失败

```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "凭证验证失败：App Secret 错误"
}
```

## 配置结构

保存后的配置（`~/.openclaw/openclaw.json`）：

```json
{
  "channels": {
    "feishu": {
      "accounts": {
        "writer": {
          "appId": "cli_a934a108bab89bd3",
          "appSecret": "xxxxx",
          "domain": "feishu",
          "dmPolicy": "open",
          "connectionMode": "websocket",
          "enabled": true,
          "groupPolicy": "open",
          "requireMention": false
        }
      }
    }
  }
}
```

## 群聊策略说明

| group_policy | 说明 | 适用场景 |
|-------------|------|---------|
| **`open`** | ✅ 允许所有群聊 | 公开服务（默认） |
| `allowlist` | 只允许配置的群聊 | 企业白名单 |
| `disabled` | 禁用群聊 | 仅私聊 |

## dmPolicy 说明

| dmPolicy | 说明 | 是否需要配对 |
|---------|------|-------------|
| **`open`** | ✅ 允许所有用户直接发消息 | **不需要** |
| `pairing` | 需要设备配对（默认） | ❌ 需要 |
| `allowlist` | 只允许 allowFrom 列表中的用户 | 视情况 |
| `disabled` | 禁用 DM | - |

**本技能自动设置 `dmPolicy: 'open'`**，绑定后用户可以直接发消息，无需配对。

## 错误处理

| 错误码 | 说明 | 解决方案 |
|--------|------|---------|
| `INVALID_CREDENTIALS` | 凭证无效 | 检查 appId/appSecret |
| `TIMEOUT` | 授权超时 | 重新扫码 |
| `USER_CANCELLED` | 用户取消 | 重新授权 |
| `EXPIRED` | 授权码过期 | 重新生成 |
| `INIT_FAILED` | 初始化失败 | 检查网络 |
| `NO_DEVICE_CODE` | 未能获取设备授权码 | 检查 API |

## 文件结构

```
feishu-qr-bind/
├── feishu-qr-bind.js    # 主脚本（增强版）
├── feishu-wizard.js     # 配置向导（独立版本）
├── SKILL.md             # 本文档
├── README-ENHANCED.md   # 增强版说明
├── README-WIZARD.md     # 向导文档
├── CHANGELOG.md         # 更新日志
└── test/                # 测试文件
```

## 参考资料

- [openakita/setup/wizard.py](https://github.com/openakita/openakita/tree/main/src/openakita/setup)
- [openakita/setup/feishu_onboard.py](https://github.com/openakita/openakita/tree/main/src/openakita/setup)
- [openclaw-lark/src/messaging/inbound/gate.js](https://github.com/openakita/openclaw-lark)
- [飞书开放平台 - OAuth 2.0](https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/oauth)
