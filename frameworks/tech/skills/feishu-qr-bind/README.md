# 飞书机器人二维码绑定技能 (feishu-qr-bind)

通过 OAuth 2.0 设备授权流程，生成二维码图片完成飞书机器人与 OpenClaw 的绑定。

## 功能特性

- ✅ 生成 PNG 格式二维码图片（512x512 像素）
- ✅ 支持飞书中国（feishu.cn）和国际版（larksuite.com）
- ✅ 自动轮询授权状态（3 秒间隔）
- ✅ 获取 appId/appSecret 后自动保存配置
- ✅ 配置备份机制，防止数据丢失
- ✅ 完整的错误处理和超时控制
- ✅ 支持生成二维码后自动通过飞书消息发送给用户

## 安装

技能已包含在 `@larksuite/openclaw-lark` 扩展中，无需额外安装。

依赖已自动安装：
- `qrcode` - PNG 二维码生成
- `axios` - HTTP 请求
- `fs-extra` - 文件系统操作

## 使用方法

### 基本用法

```javascript
// 在 OpenClaw 中调用
const result = await feishu_qr_bind({});
```

### 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| domain | string | 自动检测 | 飞书域名：`feishu`（中国）或 `lark`（国际） |
| timeout | number | 300 | 轮询超时时间（秒） |
| save_config | boolean | true | 是否自动保存 appId/appSecret 到配置 |
| send_to_feishu | boolean | false | 是否通过飞书消息发送二维码图片给用户 |
| user_open_id | string | 无 | 接收者的飞书 open_id（send_to_feishu=true 时需要） |

### 示例

#### 示例 1：标准绑定

```javascript
const result = await feishu_qr_bind({});

if (result.success) {
  console.log('绑定成功！');
  console.log('二维码路径:', result.qr_path);
  console.log('App ID:', result.app_id);
} else {
  console.error('绑定失败:', result.message);
}
```

#### 示例 2：使用国际版飞书

```javascript
const result = await feishu_qr_bind({
  domain: 'lark',
  timeout: 600, // 10 分钟超时
});
```

#### 示例 3：仅获取凭证，不保存配置

```javascript
const result = await feishu_qr_bind({
  save_config: false,
});

// 手动处理 appId/appSecret
console.log('App ID:', result.app_id);
console.log('App Secret:', result.app_secret);
```

#### 示例 4：生成二维码并自动发送到飞书

```javascript
const result = await feishu_qr_bind({
  send_to_feishu: true,
  user_open_id: 'ou_d6f374a3c5f7b1c0472ad5dd178e9441',
});

if (result.success) {
  console.log('绑定成功！');
  console.log('请求发送:', result.send_to_feishu);
  console.log('实际发送:', result.sent_to_feishu);
  if (result.send_error) {
    console.log('发送错误:', result.send_error);
  }
}
```

## 使用流程

### 步骤 1：调用工具

在 OpenClaw 中调用 `feishu_qr_bind` 工具。

### 步骤 2：扫描二维码

工具会生成二维码图片并返回路径：
- 打开飞书 App
- 扫描二维码
- 确认授权 OpenClaw 访问飞书

或者访问返回的 `qr_url` 链接进行授权。

### 步骤 3：等待确认

工具会自动轮询授权状态（每 3 秒一次），直到：
- ✅ 用户确认授权（成功）
- ❌ 超时（5 分钟默认）
- ❌ 用户取消

### 步骤 4：获取结果

授权成功后：
- `app_id` 和 `app_secret` 会自动保存到 `~/.openclaw/config.yaml`
- 返回完整的绑定结果

## 返回结果

### 成功响应

```json
{
  "success": true,
  "qr_path": "/tmp/openclaw/feishu_qr_20260320_143052.png",
  "qr_url": "https://open.feishu.cn/oauth/v1/app/registration?device_code=xxx",
  "device_code": "device_code_xxxxxxxxxxxx",
  "app_id": "cli_xxxxxxxxxxxxxxxx",
  "app_secret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "send_to_feishu": true,
  "sent_to_feishu": true,
  "send_error": null,
  "message": "飞书机器人绑定成功，配置已保存"
}
```

**字段说明**：
- `send_to_feishu`（boolean）：表示是否请求通过飞书消息发送二维码
- `sent_to_feishu`（boolean）：表示是否成功发送到飞书（仅当 send_to_feishu=true 时）
- `send_error`（string|null）：发送失败时的错误信息，成功时为 null

### 失败响应

```json
{
  "success": false,
  "error": "TIMEOUT",
  "message": "授权超时（300 秒）",
  "qr_path": "/tmp/openclaw/feishu_qr_20260320_143052.png",
  "qr_url": "https://open.feishu.cn/oauth/v1/app/registration?device_code=xxx",
  "device_code": "device_code_xxxxxxxxxxxx"
}
```

### 错误类型

| 错误代码 | 说明 | 解决方案 |
|----------|------|----------|
| `INIT_FAILED` | 初始化 OAuth 会话失败 | 检查网络连接，重试 |
| `BEGIN_FAILED` | 获取设备授权码失败 | 检查飞书 API 状态 |
| `NO_DEVICE_CODE` | 未能获取设备授权码 | 联系飞书开放平台 |
| `TIMEOUT` | 授权超时 | 重新生成二维码 |
| `USER_CANCELLED` | 用户取消授权 | 重新扫码 |
| `EXPIRED` | 授权码过期 | 重新生成二维码 |
| `NO_CREDENTIALS` | 未能获取应用凭证 | 检查飞书账号权限 |
| `CONFIG_ERROR` | 配置文件读写失败 | 检查文件权限 |

## 工作原理

```
┌─────────┐      ┌──────────────┐      ┌──────────┐      ┌──────────┐
│ OpenClaw│      │ Feishu OAuth │      │   User   │      │  Config  │
└────┬────┘      └──────┬───────┘      └────┬─────┘      └────┬─────┘
     │                  │                   │                  │
     │  1. Init OAuth   │                   │                  │
     │─────────────────>│                   │                  │
     │                  │                   │                  │
     │  2. Begin Auth   │                   │                  │
     │─────────────────>│                   │                  │
     │                  │                   │                  │
     │  3. Return       │                   │                  │
     │     device_code  │                   │                  │
     │     + qr_url     │                   │                  │
     │<─────────────────│                   │                  │
     │                  │                   │                  │
     │  4. Generate QR  │                   │                  │
     │     PNG Image    │                   │                  │
     │                  │                   │                  │
     │  [5a. Send to    │                   │                  │
     │   Feishu Chat] * │                   │                  │
     │─────────────────────────────────────>│                  │
     │                  │                   │                  │
     │                  │    5. Scan QR     │                  │
     │                  │──────────────────>│                  │
     │                  │                   │                  │
     │                  │    6. Confirm     │                  │
     │                  │<──────────────────│                  │
     │                  │                   │                  │
     │  7. Poll Status  │                   │                  │
     │─────────────────>│                   │                  │
     │                  │                   │                  │
     │  8. Confirmed    │                   │                  │
     │     + appId      │                   │                  │
     │     + appSecret  │                   │                  │
     │<─────────────────│                   │                  │
     │                  │                   │                  │
     │  9. Save Config  │                   │                  │
     │─────────────────────────────────────────────────────────>│
     │                  │                   │                  │
```

*注：步骤 5a 仅在 `send_to_feishu=true` 时执行

## 文件结构

```
~/.openclaw/extensions/openclaw-lark/skills/feishu-qr-bind/
├── SKILL.md              # 技能文档（本文件）
├── README.md             # 使用说明
├── index.js              # 导出入口
├── feishu-qr-bind.js     # 核心实现
└── package.json          # 依赖配置（可选）
```

## 配置文件

绑定成功后，appId 和 appSecret 会保存到 `~/.openclaw/config.yaml`：

```yaml
feishu:
  appId: 'cli_xxxxxxxxxxxxxxxx'
  appSecret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  domain: 'feishu'
```

配置保存前会自动备份原文件：
```
config.yaml.backup.1710921052000
```

## 二维码文件

生成的二维码图片保存在 `/tmp/openclaw/` 目录：
```
/tmp/openclaw/feishu_qr_20260320_143052.png
```

- 格式：PNG
- 尺寸：512x512 像素
- 有效期：5 分钟（与 device_code 一致）

## 故障排查

### 二维码无法扫描

1. **检查网络**：确保能访问 `open.feishu.cn` 或 `open.larksuite.com`
2. **确认域名**：使用正确的域名参数
3. **重新生成**：二维码可能已过期，重新调用工具

### 授权失败

1. **检查权限**：确认飞书账号有创建应用的权限
2. **企业白名单**：确认账号在企业授权范围内
3. **查看日志**：检查 `~/.openclaw/logs/openclaw.log`

### 配置保存失败

1. **检查权限**：确认有 `~/.openclaw/config.yaml` 的写权限
2. **手动保存**：使用返回的 appId/appSecret 手动配置
3. **检查路径**：确认 home 目录路径正确

### 轮询超时

1. **增加超时**：设置 `timeout: 600`（10 分钟）
2. **快速扫码**：在二维码有效期内完成扫码
3. **检查状态**：确认飞书 API 服务正常

## 安全提示

⚠️ **重要安全注意事项**：

1. **保护 appSecret**：不要分享或提交到版本控制
2. **配置文件权限**：确保 `config.yaml` 权限为 `600`
3. **定期轮换**：定期更新应用凭证
4. **最小权限**：只申请必要的 API 权限
5. **监控日志**：定期检查异常访问

## 相关资源

- [飞书开放平台文档](https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/oauth2/oauth-code)
- [OAuth 2.0 设备授权流程](https://open.feishu.cn/document/ukTMukTMukTM/uYjNz4SN2YjL1IzM)
- [OpenClaw 飞书插件文档](/channels/feishu)

## 相关技能

- `feishu-troubleshoot` - 飞书插件问题排查
- `feishu-calendar` - 飞书日历管理
- `feishu-bitable` - 飞书多维表格管理
- `feishu-task` - 飞书任务管理

## 版本历史

### v1.1.0 (2026-03-20)
- 新增 `send_to_feishu` 参数
- 新增 `user_open_id` 参数
- 支持生成二维码后自动通过飞书开放平台 API 发送给用户
- 返回结果中添加 `send_to_feishu`、`sent_to_feishu`、`send_error` 字段
- 发送失败不影响主流程

### v1.0.0 (2026-03-20)
- 初始版本
- 支持完整的 OAuth 设备授权流程
- PNG 二维码生成
- 自动配置保存
- 完整的错误处理

## 许可证

MIT License - 与 OpenClaw 主项目保持一致
