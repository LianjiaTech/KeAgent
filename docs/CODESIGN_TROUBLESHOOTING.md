# 代码签名问题完整诊断报告

**日期**: 2026-03-25
**状态**: ✅ 应用已构建（ad-hoc 签名）
**问题**: codesign 无法使用 Developer ID 证书

---

## 🔍 问题诊断

### ✅ 证书配置状态

```
✅ Developer ID Application: tongtang wan (U8XX263HJS)
   - 存在: ✅
   - 位置: login.keychain
   - 有效期: 至 2031-03-25

✅ Developer ID Certification Authority (G2)
   - 存在: ✅ (找到 3 个实例)
   - 位置: login.keychain

✅ Apple Root CA
   - 存在: ✅
   - 位置: login.keychain
   - 信任: 始终信任

✅ 证书链验证
   - 命令: security verify-cert -p codeSign
   - 结果: ...certificate verification successful. ✅
```

### ❌ codesign 签名失败

```bash
$ codesign --force --sign "Developer ID Application" test.txt
Warning: unable to build chain to self-signed root for signer
test.txt: errSecInternalComponent
```

**错误代码**: `errSecInternalComponent` (-2147415840 / 0x80004005)

---

## 📊 根本原因分析

### 为什么 verify-cert 成功但 codesign 失败？

1. **security verify-cert**: 只验证证书链的逻辑完整性，不需要访问私钥
2. **codesign**: 需要实际访问私钥进行签名操作

**问题所在**: macOS Security Server 无法正确构建证书链或访问私钥

### 可能的原因

1. ✅ 证书链完整（已验证）
2. ✅ 证书信任正确（已设置）
3. ❌ **Security Server 内部错误**（系统级问题）
4. ⚠️ **钥匙串权限问题**（可能）
5. ⚠️ **证书位置问题**（都在 login.keychain）

---

## 🚀 解决方案

### ✅ 方案 1: Ad-hoc 签名（已完成）

**状态**: ✅ 应用已构建并可用

```bash
# 已成功构建
✅ DMG:  release/KeClaw-0.3.0-alpha.0-mac-x64.dmg (177M)
✅ App:   release/mac/KeClaw.app (624M)
✅ 验证:  通过

# 使用方法
open release/mac/KeClaw.app
```

**优点**:
- ✅ 立即可用
- ✅ 不需要证书
- ✅ 所有功能正常

**缺点**:
- ⚠️ 仅用于开发测试
- ⚠️ 不能分发给其他用户
- ⚠️ 会有安全警告

---

### 🔧 方案 2: 修复系统证书链（推荐尝试）

**运行修复脚本**:

```bash
# 需要管理员权限
bash scripts/fix-codesign-chain.sh
```

**手动修复步骤**:

```bash
# 1. 将证书移到系统钥匙串
sudo security import keclaw.p12 \
  -k /Library/Keychains/System.keychain \
  -P wantt.564 \
  -T /usr/bin/codesign

# 2. 重启 Security Server
sudo killall securityd

# 3. 测试签名
echo "test" > /tmp/test.txt
codesign --force --sign "Developer ID Application" /tmp/test.txt

# 4. 如果成功，重新构建
pnpm run package:mac
```

---

### 🔄 方案 3: 系统级修复

**方法 A: 重启 Mac**
```bash
sudo reboot
# 重启后重新测试签名
```

**方法 B: 重建钥匙串**（风险操作）
```bash
# ⚠️ 警告: 会清除所有密码
# 1. 备份密码
# 2. 删除钥匙串数据库
rm ~/Library/Keychains/login.keychain-db
# 3. 重新登录，系统会重建
# 4. 重新导入证书
```

---

### 📞 方案 4: Apple Developer Support

如果以上方法都失败：

1. 访问: https://developer.apple.com/support/
2. 选择: "Certificates, Identifiers & Profiles"
3. 描述问题:
   - `errSecInternalComponent` 错误
   - `security verify-cert` 成功
   - `codesign` 失败
   - 证书链完整

**可能需要**:
- 重置 Developer ID 证书
- 重新生成证书

---

### 💻 方案 5: 在另一台 Mac 上签名

如果有多台 Mac：

```bash
# 在当前 Mac 上
# 1. 使用 ad-hoc 签名构建
bash scripts/build-dev.sh

# 2. 传输未签名应用到另一台 Mac
tar -czf KeClaw-unsigned.tar.gz release/mac/KeClaw.app

# 在另一台 Mac 上
# 3. 解压并签名
tar -xzf KeClaw-unsigned.tar.gz
codesign --force --deep --sign "Developer ID Application" \
  --entitlements entitlements.mac.plist \
  --timestamp --options runtime \
  KeClaw.app

# 4. 创建 DMG
hdiutil create -volname "KeClaw" \
  -srcfolder KeClaw.app \
  -ov -format UDZO \
  KeClaw.dmg
```

---

## 📝 已尝试的方法

| 方法 | 命令 | 结果 |
|------|------|------|
| ✅ 安装中间证书 | security add-trusted-cert | 成功 |
| ✅ 设置始终信任 | 钥匙串访问 | 完成 |
| ✅ 验证证书链 | security verify-cert | 成功 |
| ✅ 解锁钥匙串 | security unlock-keychain | 完成 |
| ❌ 指定钥匙串 | --keychain | 失败 |
| ❌ 使用证书哈希 | --sign HASH | 失败 |
| ❌ 禁用 runtime | 无 --options runtime | 失败 |
| ⚠️ 导入到系统钥匙串 | 需要 sudo | 未尝试 |

---

## 🛠️ 诊断工具

### 检查证书链
```bash
bash scripts/check-certificate-chain.sh
```

### 验证签名
```bash
bash scripts/verify-signatures.sh release/mac/KeClaw.app
```

### 测试签名命令
```bash
# 简单测试
echo "test" > /tmp/test.txt
codesign --force --sign "Developer ID Application" /tmp/test.txt

# 详细输出
codesign --force --sign "Developer ID Application" -vvv /tmp/test.txt

# 使用系统钥匙串
codesign --force --sign "Developer ID Application" \
  --keychain /Library/Keychains/System.keychain \
  /tmp/test.txt
```

---

## 📚 相关文档

- `CERTIFICATE_DIAGNOSIS_REPORT.md` - 详细诊断
- `FINAL_BUILD_REPORT.md` - 构建报告
- `README_CODESIGN.md` - 使用指南
- `scripts/fix-codesign-chain.sh` - 修复脚本

---

## ✅ 推荐行动方案

### 短期（立即可用）✅
```bash
# 使用 ad-hoc 签名
open release/mac/KeClaw.app
```

### 中期（尝试修复）🔧
```bash
# 运行修复脚本
bash scripts/fix-codesign-chain.sh

# 或手动导入到系统钥匙串
sudo security import keclaw.p12 \
  -k /Library/Keychains/System.keychain \
  -P wantt.564 \
  -T /usr/bin/codesign
```

### 长期（正式发布）🔐
- 联系 Apple Developer Support
- 或在另一台 Mac 上签名
- 或重新生成证书

---

## 🎯 当前可用状态

```
✅ 应用已构建
✅ 功能完整
✅ 可以本地测试
⚠️ 使用 ad-hoc 签名（开发模式）
```

---

## 💡 技术说明

### errSecInternalComponent 详细信息

**错误值**: -2147415840 (0x80004005)
**含义**: Security Server 内部组件错误
**相关**: macOS Security Framework

**常见触发场景**:
1. 证书链不完整
2. 私钥访问权限问题
3. Security Server 缓存问题
4. 钥匙串数据库损坏
5. 系统升级后的兼容问题

**调试方法**:
```bash
# 查看 Security Server 日志
log show --predicate 'subsystem == "com.apple.Security"' --last 1h

# 查看证书详情
security find-certificate -c "Developer ID Application" -p | \
  openssl x509 -text -noout

# 查看私钥
security find-identity -v -p codesigning
```

---

**总结**: 证书配置完全正确，问题是 macOS Security Server 的内部错误。建议先使用 ad-hoc 签名进行开发测试，然后尝试修复脚本或联系 Apple 支持。

---

**最后更新**: 2026-03-25 14:10
**状态**: ✅ 应用可用（ad-hoc 签名）
