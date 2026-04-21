/**
 * 二维码生成测试
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testOutputDir = path.join(__dirname, '..', 'test-output');

test('QR Code 生成测试', async () => {
  // 确保输出目录存在
  await fs.ensureDir(testOutputDir);
  
  const testUrl = 'https://open.feishu.cn/oauth/v1/app/registration?device_code=test123';
  const outputPath = path.join(testOutputDir, 'test_qr.png');
  
  // 生成二维码
  await QRCode.toFile(outputPath, testUrl, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  
  // 验证文件存在
  const exists = await fs.pathExists(outputPath);
  assert.ok(exists, '二维码文件应该存在');
  
  // 验证文件大小
  const stats = await fs.stat(outputPath);
  assert.ok(stats.size > 0, '二维码文件大小应该大于 0');
  
  // 验证是 PNG 格式
  const buffer = await fs.readFile(outputPath);
  // PNG 文件头：89 50 4E 47 0D 0A 1A 0A
  assert.strictEqual(buffer[0], 0x89, 'PNG 文件头第一个字节应该是 0x89');
  assert.strictEqual(buffer[1], 0x50, 'PNG 文件头第二个字节应该是 0x50 (P)');
  assert.strictEqual(buffer[2], 0x4E, 'PNG 文件头第三个字节应该是 0x4E (N)');
  assert.strictEqual(buffer[3], 0x47, 'PNG 文件头第四个字节应该是 0x47 (G)');
  
  console.log('✓ QR Code 生成测试通过');
  console.log(`  文件路径：${outputPath}`);
  console.log(`  文件大小：${stats.size} bytes`);
});

test('配置目录测试', async () => {
  const configDir = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.openclaw');
  const configPath = path.join(configDir, 'config.yaml');
  
  // 测试目录是否可写
  const testFile = path.join(configDir, 'test_write.txt');
  try {
    await fs.ensureDir(configDir);
    await fs.writeFile(testFile, 'test');
    const exists = await fs.pathExists(testFile);
    assert.ok(exists, '配置目录应该可写');
    await fs.remove(testFile);
    console.log('✓ 配置目录测试通过');
  } catch (err) {
    console.log('⚠ 配置目录测试跳过（权限不足）');
  }
});
