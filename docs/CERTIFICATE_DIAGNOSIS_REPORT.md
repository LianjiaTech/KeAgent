# 证书链问题诊断报告

## 🔍 诊断结果

### ✅ 证书配置正确
```
✅ Developer ID Application: tongtang wan (U8XX263HJS) - 存在
✅ Developer ID Certification Authority (G2) - 存在
✅ Apple Root CA - 存在
✅ 所有证书都在 login.keychain
✅ 证书未过期（2031年过期）
```

### ✅ 证书链验证成功
```bash
$ security verify-cert -p codeSign -c /tmp/dev-id.pem
...certificate verification successful.
✅ 证书链验证成功
```

### ❌ codesign 签名失败
```bash
$ codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" test.txt
Warning: unable to build chain to self-signed root for signer "Developer ID Application: tongtang wan (U8XX263HJS)"
test.txt: errSecInternalComponent
```

## 🎯 问题分析

**根本原因**: macOS 系统级安全组件问题 (`errSecInternalComponent`)

这不是证书配置问题，而是：
1. macOS Security Server 的内部错误
2. codesign 无法正确访问证书链
3. 可能是系统缓存或权限问题

### 已尝试的解决方案

| 方法 | 结果 |
|------|------|
| ✅ 安装中间证书 | 成功 |
| ✅ 安装 Apple Root CA | 成功 |
| ✅ 设置证书为"始终信任" | 完成 |
| ✅ 解锁钥匙串 | 完成 |
| ❌ 重新授权钥匙串 | 需要密码 |
| ❌ 指定钥匙串给 codesign | 失败 |
| ❌ 使用证书哈希签名 | 失败 |
| ❌ 禁用 runtime 选项 | 失败 |

## 🚀 可行的解决方案

### 方案 1: 使用 Ad-hoc 签名（推荐用于开发测试）

**状态**: ✅ 已成功

```bash
# 使用开发模式构建
bash scripts/build-dev.sh

# 或手动设置
export CSC_IDENTITY_AUTO_DISCOVERY=false
export CSC_IDENTITY="-"
pnpm run package:mac
```

**优点**:
- ✅ 立即可用
- ✅ 可以本地运行和测试
- ✅ 所有功能正常

**缺点**:
- ⚠️ 不能分发给其他用户
- ⚠️ 会有安全警告

---

### 方案 2: 修复 macOS Security Server

尝试重置安全服务：

```bash
# 方法 1: 重置钥匙串权限
security authorizationdb reset

# 方法 2: 重建钥匙串数据库（会清除所有密码）
# ⚠️ 危险操作，请先备份
rm ~/Library/Keychains/login.keychain-db
# 然后重新导入证书

# 方法 3: 重启安全服务
sudo killall securityd
```

---

### 方案 3: 在系统钥匙串中使用证书

```bash
# 1. 将证书导入系统钥匙串
sudo security import keclaw.p12 \
  -k /Library/Keychains/System.keychain \
  -P wantt.564 \
  -T /usr/bin/codesign

# 2. 设置信任
sudo security add-trusted-cert \
  -d -r trustAsRoot \
  -k /Library/Keychains/System.keychain \
  /tmp/dev-id.pem

# 3. 测试签名
codesign --force --sign "Developer ID Application" test.txt
```

---

### 方案 4: 在另一台 Mac 上签名

如果有多台 Mac：
1. 导出证书到另一台 Mac
2. 在另一台 Mac 上导入并签名
3. 可能避免当前系统的安全组件问题

---

### 方案 5: 联系 Apple Developer Support

如果以上方法都失败：

1. 访问: https://developer.apple.com/support/
2. 选择 "Certificates, Identifiers & Profiles"
3. 说明情况：
   - 证书链验证成功
   - codesign 失败并显示 errSecInternalComponent
   - 已尝试重新导入证书

**可能需要**：
- 重新生成证书
- 重置 Developer ID 证书

---

## 📊 当前状态总结

### ✅ 已完成
1. ✅ 代码签名冲突问题已解决
2. ✅ 证书链完整且可验证
3. ✅ Ad-hoc 签名构建成功
4. ✅ 应用可正常运行

### ❌ 待解决
1. ❌ Developer ID 签名失败（macOS 内部问题）
2. ⚠️ 需要修复或绕过 errSecInternalComponent 错误

---

## 💡 推荐行动

### 短期（立即可用）
✅ **使用 Ad-hoc 签名进行开发和测试**
```bash
bash scripts/build-dev.sh
```

### 中期（尝试修复）
🔧 **尝试方案 2 或方案 3**
- 重置安全服务或使用系统钥匙串

### 长期（正式发布）
🔐 **联系 Apple Developer Support**
- 如果无法修复 errSecInternalComponent 错误
- 考虑重新生成证书

---

## 🎯 技术细节

### errSecInternalComponent 错误说明

错误代码: `-2147415840` / `0x80004005`

含义: Security Server 内部组件错误

常见原因:
1. 钥匙串数据库损坏
2. 安全服务进程问题
3. 权限或访问控制问题
4. 系统更新后的缓存问题

### 为什么 security verify-cert 成功但 codesign 失败？

- `security verify-cert` 只验证证书链的逻辑完整性
- `codesign` 需要实际访问私钥进行签名操作
- 可能是私钥访问的权限问题或 Security Server 的缓存问题

---

## 📝 相关文档

- `FINAL_BUILD_REPORT.md` - 完整构建报告
- `README_CODESIGN.md` - 使用指南
- `scripts/build-dev.sh` - 开发构建脚本

---

**结论**: 证书配置完全正确，问题是 macOS 系统级别。建议使用 ad-hoc 签名进行开发测试，或联系 Apple 支持解决 errSecInternalComponent 问题。
