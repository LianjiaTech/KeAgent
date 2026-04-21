# macOS 应用公证指南

本文档记录 KeClaw 应用的 macOS 公证流程。

## 前提条件

1. **Apple Developer 账号** - 需要付费的 Apple Developer Program ($99/年)
2. **Developer ID 证书** - 已安装 Developer ID Application 证书
3. **App-Specific Password** - 从 appleid.apple.com 生成的专用密码

## 一次性设置

### 1. 生成 App-Specific Password

1. 访问 https://appleid.apple.com
2. 登录你的 Apple ID
3. 进入 "Security" → "App-Specific Passwords"
4. 点击 "Generate Password"
5. 输入标签（如 "KeClaw Notarization"）
6. 复制生成的密码（格式: `xxxx-xxxx-xxxx-xxxx`）

### 2. 获取 Team ID

在 Apple Developer 账户页面可以找到 Team ID（格式: `XXXXXXXXXX`）

### 3. 配置环境变量

在项目根目录创建 `.env` 文件（已在 `.gitignore` 中）：

```bash
APPLE_ID=your-apple-id@email.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX
```

## 公证流程

### 自动方式（推荐）

**首次使用：**

```bash
# 1. 复制模板
cp .env.example .env

# 2. 编辑 .env，填入你的 Apple 凭证
# APPLE_ID=your@email.com
# APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
# APPLE_TEAM_ID=XXXXXXXXXX

# 3. 运行公证脚本
./scripts/notarize-macos.sh
```

**后续使用：**

```bash
# 正常构建（会自动公证）
./scripts/notarize-macos.sh

# 清理后重新构建
./scripts/notarize-macos.sh --clean
```

### 手动方式

```bash
# 设置环境变量
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"

# 清理旧构建
rm -rf release/

# 构建并公证
pnpm package:mac
```

## 配置说明

`electron-builder.yml` 中的公证配置：

```yaml
mac:
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: entitlements.mac.plist
  entitlementsInherit: entitlements.mac.plist
  notarize: true  # 启用公证
```

## 验证公证结果

```bash
# 验证 x64 版本
spctl -a -t execute -vvv release/mac/KeClaw.app

# 验证 arm64 版本
spctl -a -t execute -vvv release/mac-arm64/KeClaw.app

# 验证 stapling
stapler validate release/mac/KeClaw.app
stapler validate release/mac-arm64/KeClaw.app
```

成功的输出应包含：
```
source=Notarized Developer ID
```

## 公证时间线

| 阶段 | 时间 |
|------|------|
| 构建前端 | ~30 秒 |
| 打包应用 | ~2 分钟 |
| 代码签名 | ~1 分钟 |
| Apple 公证 | 5-15 分钟 |
| 总计 | ~10-20 分钟 |

## 常见问题

### Q: 公证失败，显示 "The signature of the binary is invalid"

确保：
1. Developer ID 证书已正确安装
2. 证书没有过期
3. 运行 `./scripts/fix-errsecinternal.sh` 修复可能的密钥权限问题

### Q: 公证超时

Apple 服务器可能繁忙，等待更长时间或重试。

### Q: 如何查看公证状态

```bash
# 查看最近的公证提交
xcrun notarytool history \
  --apple-id $APPLE_ID \
  --password $APPLE_APP_SPECIFIC_PASSWORD \
  --team-id $APPLE_TEAM_ID
```

### Q: 如何获取公证日志

```bash
xcrun notarytool log <submission-id> \
  --apple-id $APPLE_ID \
  --password $APPLE_APP_SPECIFIC_PASSWORD \
  --team-id $APPLE_TEAM_ID
```

## 分发

公证完成后，DMG 文件可以直接分发给用户：

1. 上传到 OTA 服务器
2. 用户下载后双击安装
3. 首次打开不会再显示"无法验证开发者"警告

## 安全注意事项

- **永远不要**将 `.env` 文件提交到 Git
- **永远不要**在代码中硬编码 Apple ID 密码
- App-Specific Password 应定期更换
- 如果密码泄露，立即在 appleid.apple.com 撤销

## 相关文件

| 文件 | 说明 |
|------|------|
| `electron-builder.yml` | 构建配置，包含 `notarize: true` |
| `entitlements.mac.plist` | macOS 权限声明 |
| `scripts/notarize-macos.sh` | 自动化公证脚本 |
| `.env` | 凭证配置（不提交到 Git） |
