# 解决 errSecInternalComponent 错误的完整指南

## 🎯 问题根源

`errSecInternalComponent` 是 macOS Security Server 的内部错误，即使证书链完整也可能发生。

**你的情况**:
- ✅ 证书链验证成功 (`security verify-cert` 通过)
- ✅ 所有证书都已安装
- ✅ 证书信任设置为"始终信任"
- ❌ `codesign` 仍然失败

**原因**: macOS Security Server 无法正确访问证书链或私钥

---

## 🚀 解决方案（按推荐顺序）

### 方案 1: 将证书导入系统钥匙串 ⭐ 推荐

**为什么有效**: 系统钥匙串对所有进程可见，避免权限问题

**步骤**:

```bash
# 1. 运行修复脚本
bash scripts/fix-errsecinternal.sh

# 或手动执行
sudo security import keagent.p12 \
  -k /Library/Keychains/System.keychain \
  -P wantt.564 \
  -T /usr/bin/codesign \
  -T /usr/bin/productbuild

# 2. 测试签名
echo "test" > /tmp/test.txt
codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" /tmp/test.txt

# 3. 如果成功，重新构建
pnpm run package:mac
```

**成功标志**: 没有 `errSecInternalComponent` 错误

---

### 方案 2: 重启 Mac 🔄

**为什么有效**: 清除 Security Server 缓存和状态

**步骤**:
```bash
# 重启
sudo reboot

# 重启后测试
echo "test" > /tmp/test.txt
codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" /tmp/test.txt
```

**成功率**: 约 30% (简单的缓存问题)

---

### 方案 3: 重置钥匙串权限 🔐

**为什么有效**: 修复 codesign 访问私钥的权限

**步骤**:
```bash
# 1. 解锁钥匙串
security unlock-keychain

# 2. 重置权限（需要登录密码）
security set-key-partition-list -S apple-tool:,apple: -s -k "YOUR_LOGIN_PASSWORD" login.keychain

# 3. 测试签名
echo "test" > /tmp/test.txt
codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" /tmp/test.txt
```

**注意**: 将 `YOUR_LOGIN_PASSWORD` 替换为你的 Mac 登录密码

---

### 方案 4: 在新的钥匙串中重新导入证书 🔧

**为什么有效**: 避免钥匙串数据库损坏

**步骤**:
```bash
# 1. 创建新的钥匙串
security create-keychain -p "temp123" /tmp/codesign.keychain

# 2. 导入证书
security import keagent.p12 \
  -k /tmp/codesign.keychain \
  -P wantt.564 \
  -T /usr/bin/codesign

# 3. 设置为签名默认钥匙串
security list-keychains -d user -s /tmp/codesign.keychain login.keychain

# 4. 测试签名
echo "test" > /tmp/test.txt
codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" \
  --keychain /tmp/codesign.keychain \
  /tmp/test.txt

# 5. 如果成功，构建时指定钥匙串
export CSC_KEYCHAIN=/tmp/codesign.keychain
pnpm run package:mac
```

---

### 方案 5: 使用 Apple 的签名单独签名 📦

**为什么有效**: 绕过 electron-builder 的自动签名

**步骤**:
```bash
# 1. 先用 ad-hoc 构建
export CSC_IDENTITY_AUTO_DISCOVERY=false
pnpm run package:mac

# 2. 然后手动签名应用
codesign --force --deep --sign "Developer ID Application: tongtang wan (U8XX263HJS)" \
  --entitlements entitlements.mac.plist \
  --timestamp --options runtime \
  release/mac/KeAgent.app

# 3. 验证签名
codesign --verify --deep --strict release/mac/KeAgent.app

# 4. 手动创建 DMG（可选）
hdiutil create -volname "KeAgent" \
  -srcfolder release/mac/KeAgent.app \
  -ov -format UDZO \
  release/KeAgent-signed.dmg
```

---

### 方案 6: 在另一台 Mac 上签名 💻

**为什么有效**: 可能是当前 Mac 的特定问题

**步骤**:
```bash
# 当前 Mac:
# 1. 用 ad-hoc 构建
bash scripts/build-dev.sh

# 2. 打包应用
tar -czf KeAgent-app.tar.gz release/mac/KeAgent.app

# 传输到另一台 Mac，然后:

# 另一台 Mac:
# 3. 解压
tar -xzf KeAgent-app.tar.gz

# 4. 签名
codesign --force --deep --sign "Developer ID Application" \
  --entitlements entitlements.mac.plist \
  --timestamp --options runtime \
  KeAgent.app

# 5. 创建 DMG
hdiutil create -volname "KeAgent" \
  -srcfolder KeAgent.app \
  -ov -format UDZO \
  KeAgent.dmg
```

---

### 方案 7: 联系 Apple Developer Support 📞

**适用情况**: 所有方法都失败

**步骤**:
1. 访问: https://developer.apple.com/support/
2. 选择 "Certificates, Identifiers & Profiles"
3. 提交请求:

**描述模板**:
```
主题: Developer ID 证书签名失败 - errSecInternalComponent

描述:
我遇到 codesign 签名失败的问题：

1. 证书信息:
   - Developer ID Application: tongtang wan (U8XX263HJS)
   - 有效期: 2026-03-24 至 2031-03-25
   - Team ID: U8XX263HJS

2. 证书链状态:
   ✅ Developer ID Application: 存在
   ✅ Developer ID Certification Authority (G2): 存在
   ✅ Apple Root CA: 存在
   ✅ 信任设置: 始终信任

3. 验证结果:
   ✅ security verify-cert -p codeSign: 成功
   ❌ codesign --sign: 失败，错误 errSecInternalComponent

4. 错误信息:
   Warning: unable to build chain to self-signed root for signer
   file: errSecInternalComponent

5. 已尝试的解决方案:
   - 重新导入证书
   - 设置始终信任
   - 安装中间证书
   - 重启 Mac
   - 解锁钥匙串

请求:
- 是否需要重新生成证书？
- 是否有其他解决方案？
```

**可能的结果**:
- 重新生成证书（最彻底的解决方案）
- Apple 工程师远程协助
- 提供系统级修复工具

---

## ✅ 推荐执行顺序

1. **立即尝试** (5分钟):
   - 方案 1: 导入到系统钥匙串

2. **如果失败** (10分钟):
   - 方案 2: 重启 Mac
   - 方案 3: 重置钥匙串权限

3. **如果仍失败** (20分钟):
   - 方案 4: 新建钥匙串
   - 方案 5: 手动签名

4. **最后选择**:
   - 方案 6: 另一台 Mac
   - 方案 7: Apple Developer Support

---

## 🧪 测试步骤

每次尝试后，运行此测试：

```bash
# 简单测试
echo "test" > /tmp/test.txt
codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" /tmp/test.txt

# 如果成功，验证签名
codesign -dv /tmp/test.txt

# 如果成功，测试构建
pnpm run package:mac
```

**成功标志**:
- ✅ 没有 `errSecInternalComponent` 错误
- ✅ `codesign -dv` 显示签名信息
- ✅ 构建成功完成

---

## 📊 成功率估计

| 方案 | 成功率 | 时间 |
|------|--------|------|
| 方案 1: 系统钥匙串 | 60% | 5分钟 |
| 方案 2: 重启 | 30% | 5分钟 |
| 方案 3: 重置权限 | 20% | 5分钟 |
| 方案 4: 新钥匙串 | 40% | 10分钟 |
| 方案 5: 手动签名 | 50% | 10分钟 |
| 方案 6: 另一台 Mac | 90% | 30分钟 |
| 方案 7: Apple 支持 | 100% | 1-3天 |

---

## 💡 临时方案（开发测试）

在解决问题期间，继续使用 ad-hoc 签名：

```bash
# 使用开发模式构建
bash scripts/build-dev.sh

# 或设置环境变量
export CSC_IDENTITY_AUTO_DISCOVERY=false
pnpm run package:mac

# 运行应用
open release/mac/KeAgent.app
```

**优点**:
- ✅ 立即可用
- ✅ 不影响开发进度

**缺点**:
- ⚠️ 仅限本地测试
- ⚠️ 不能分发

---

## 🔍 调试命令

查看详细错误信息：

```bash
# 查看 Security Server 日志
log show --predicate 'subsystem == "com.apple.Security"' --last 1h

# 详细签名过程
codesign --force --sign "Developer ID Application" -vvv /tmp/test.txt 2>&1

# 检查证书访问权限
security dump-trust-settings -d

# 查看钥匙串状态
security show-keychain-info
```

---

## 📝 记录结果

请记录每个方案的尝试结果，以便进一步诊断：

```bash
# 创建测试记录
cat > /tmp/codesign-test-log.txt << 'EOF'
测试日期: $(date)

方案 X: [方案名称]
命令: [执行的命令]
结果: [成功/失败]
错误信息: [如果有]
EOF
```

---

**下一步**: 建议先尝试**方案 1**（导入到系统钥匙串），这是最可能成功的解决方案。

**需要帮助**: 如果所有方案都失败，请运行 `bash scripts/fix-errsecinternal.sh` 并提供完整输出。
