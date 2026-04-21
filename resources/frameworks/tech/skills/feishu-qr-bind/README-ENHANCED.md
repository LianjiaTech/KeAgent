# feishu-qr-bind - 飞书机器人绑定工具

## 功能特性

✅ **参考实现**
- [openakita/setup/feishu_onboard.py](https://github.com/openakita/openakita/tree/main/src/openakita/setup) - Device Flow 三步流程
- [openclaw-lark/src/messaging/inbound/gate.js](https://github.com/openakita/openclaw-lark) - dmPolicy 配置

✅ **核心功能**
- 飞书 OAuth 2.0 设备授权（Device Flow）
- 自动获取 appId/appSecret
- 自动保存配置到 openclaw.json
- 自动设置 dmPolicy: 'open'（无需配对）
- 支持飞书中国/国际版自动识别
- 终端 ASCII 二维码渲染
- 凭证验证（tenant_access_token）

✅ **用户体验**
- 一次扫码完成绑定
- 自动发送二维码到飞书
- 完整的错误处理和提示
- 轮询状态实时反馈

---

## Device Flow 流程

参考 openakita 的实现，Device Flow 分为三步：

```
1. init   → 握手，获取 supported_auth_methods
2. begin  → 提交 archetype/auth_method → 返回 device_code + verification_uri
3. poll   → 轮询授权状态 → 成功后返回 client_id + client_secret
```

**API 端点**：
- 飞书中国：`https://accounts.feishu.cn/oauth/v1/app/registration`
- 飞书国际：`https://accounts.larksuite.com/oauth/v1/app/registration`

---

## 使用示例

### 基础绑定

```javascript
import feishu_qr_bind from './feishu-qr-bind.js';

const result = await feishu_qr_bind({
  domain: 'feishu',        // 'feishu' | 'lark'
  account_name: 'ceo',     // 绑定到哪个 agent
  save_config: true,       // 自动保存配置
});

console.log(result);
```

### 发送到飞书

```javascript
const result = await feishu_qr_bind({
  domain: 'feishu',
  account_name: 'writer',
  send_to_feishu: true,    // 发送二维码到飞书
  user_open_id: 'ou_xxx',  // 接收者的 open_id
});
```

### 绑定到多个 agent

```javascript
// 绑定到 secretary
await feishu_qr_bind({
  domain: 'feishu',
  account_name: 'secretary',
  send_to_feishu: true,
});

// 绑定到 social
await feishu_qr_bind({
  domain: 'feishu',
  account_name: 'social',
  send_to_feishu: true,
});

// 绑定到 multimodal
await feishu_qr_bind({
  domain: 'feishu',
  account_name: 'multimodal',
  send_to_feishu: true,
});
```

---

## 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `domain` | string | - | 飞书域名 (`feishu` \| `lark`) |
| `account_name` | string | `'ceo'` | 账户名称（对应 agent 的 accountId） |
| `save_config` | boolean | `true` | 是否自动保存配置 |
| `send_to_feishu` | boolean | `false` | 是否通过飞书消息发送二维码 |
| `user_open_id` | string | - | 接收者的飞书 open_id |
| `timeout` | number | `600` | 轮询超时时间（秒） |

---

## 返回结果

### 成功

```javascript
{
  success: true,
  qr_path: "/tmp/openclaw/feishu_qr_2026-03-21T0422.png",
  qr_url: "https://open.feishu.cn/page/openclaw?user_code=CLQX-KH9C",
  device_code: "v1:eyJhbGciOiJFUzI1NiIs...",
  app_id: "cli_a934a108bab89bd3",
  app_secret: "xxxxx",
  account_name: "secretary",
  send_to_feishu: true,
  sent_to_feishu: true,
  send_error: null,
  message: "飞书机器人绑定成功，配置已保存到账户 [secretary]（dmPolicy: open，无需配对）"
}
```

### 失败

```javascript
{
  success: false,
  error: "TIMEOUT",  // 或 USER_CANCELLED, EXPIRED, etc.
  message: "授权超时，请重新生成二维码",
  qr_path: "...",
  qr_url: "..."
}
```

---

## dmPolicy 配置说明

参考官方插件 `gate.js`，`dmPolicy` 控制 DM（私聊）访问策略：

| dmPolicy 值 | 说明 | 是否需要配对 |
|------------|------|-------------|
| **`open`** | ✅ 允许所有用户直接发消息 | **不需要** |
| `pairing` | 需要设备配对（默认） | ❌ 需要 |
| `allowlist` | 只允许 allowFrom 列表中的用户 | 视情况 |
| `disabled` | 禁用 DM | - |

**本脚本自动设置 `dmPolicy: 'open'`**，绑定后用户可以直接发消息，无需配对。

---

## 错误处理

### 常见错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|---------|
| `TIMEOUT` | 授权超时 | 重新生成二维码 |
| `USER_CANCELLED` | 用户取消授权 | 重新扫码 |
| `EXPIRED` | 授权码过期 | 重新生成二维码 |
| `ACCESS_DENIED` | 访问被拒绝 | 检查权限 |
| `NO_DEVICE_CODE` | 未能获取设备授权码 | 检查网络 |
| `INVALID_CREDENTIALS` | 凭证验证失败 | 检查 appId/appSecret |

---

## 文件结构

```
feishu-qr-bind/
├── feishu-qr-bind.js    # 核心脚本
├── SKILL.md             # 技能规范文档
├── README.md            # 本文档
├── EXAMPLE.md           # 使用示例
└── test/                # 单元测试
```

---

## 依赖

- `axios` - HTTP 客户端
- `qrcode` - 二维码生成（PNG）
- `qrcode-terminal` - 终端二维码渲染（可选）
- `fs-extra` - 文件系统
- `form-data` - FormData（上传图片）

---

## 完整绑定流程

```
1. 用户扫 OAuth 二维码
   ↓
2. FeishuAuth.init() → 握手
   ↓
3. FeishuAuth.begin() → 获取 device_code
   ↓
4. 生成二维码（PNG + 终端 ASCII）
   ↓
5. FeishuAuth.poll() → 轮询授权状态
   ↓
6. 获取 appId/appSecret
   ↓
7. validateAppCredentials() → 验证凭证
   ↓
8. saveConfig() → 保存配置（dmPolicy: 'open'）
   ↓
9. 完成绑定 ✅
```

---

## 与官方插件对比

| 功能 | 官方插件 | feishu-qr-bind |
|------|---------|---------------|
| OAuth 授权 | ✅ | ✅ |
| 自动保存配置 | ✅ | ✅ |
| dmPolicy 配置 | 手动 | ✅ 自动设置 'open' |
| 终端二维码 | ❌ | ✅ ASCII 渲染 |
| 飞书消息发送 | ❌ | ✅ 自动发送 |
| 凭证验证 | ✅ | ✅ |
| 多 agent 绑定 | ❌ | ✅ 支持 |

---

## 许可证

MIT License

---

## 参考资料

- [openakita/setup/feishu_onboard.py](https://github.com/openakita/openakita/tree/main/src/openakita/setup)
- [openclaw-lark/src/messaging/inbound/gate.js](https://github.com/openakita/openclaw-lark)
- [飞书开放平台 - OAuth 2.0](https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/oauth)
