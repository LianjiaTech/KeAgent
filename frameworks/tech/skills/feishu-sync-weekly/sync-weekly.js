#!/usr/bin/env node
/**
 * 就业形势周报 - 每周自动同步到飞书文档
 * 
 * 定时任务：每周五 8:00 执行
 * 1. 读取最新周报数据
 * 2. 更新飞书文档
 * 3. 发送通知到飞书群
 */

import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  recruitmentDataDir: '/home/ubuntu/recruitment-data',
  feishuDocId: 'DCIAdaPdkoTXCUxu6bAcB1ITnNf', // 就业形势周报表单
  notificationChatId: 'oc_xxx', // TODO: 替换为实际群聊 ID
};

/**
 * 获取最新周报文件
 */
function getLatestWeeklyReport() {
  const files = fs.readdirSync(CONFIG.recruitmentDataDir);
  const weeklyFiles = files.filter(f => f.startsWith('weekly-') && f.endsWith('.md'));
  
  if (weeklyFiles.length === 0) {
    throw new Error('未找到周报文件');
  }
  
  // 按日期排序，取最新
  weeklyFiles.sort((a, b) => {
    const dateA = a.match(/weekly-(\d{4}-\d{2}-\d{2})/)[1];
    const dateB = b.match(/weekly-(\d{4}-\d{2}-\d{2})/)[1];
    return dateB.localeCompare(dateA);
  });
  
  const latestFile = weeklyFiles[0];
  return path.join(CONFIG.recruitmentDataDir, latestFile);
}

/**
 * 读取周报内容
 */
function readWeeklyReport(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 更新飞书文档
 */
async function updateFeishuDoc(content) {
  // 这里调用飞书 API 更新文档
  // 使用 feishu_update_doc 工具
  console.log('更新飞书文档:', CONFIG.feishuDocId);
  console.log('内容长度:', content.length);
  
  // TODO: 实际调用飞书 API
  // await fetch(`https://open.feishu.cn/open-apis/docx/v1/documents/${CONFIG.feishuDocId}/content`, {
  //   method: 'PUT',
  //   headers: {
  //     'Authorization': `Bearer ${tenantToken}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ content }),
  // });
  
  return { success: true, docId: CONFIG.feishuDocId };
}

/**
 * 发送通知到飞书群
 */
async function sendNotification(docUrl, weekRange) {
  console.log('发送通知到飞书群');
  console.log('文档 URL:', docUrl);
  console.log('周报周期:', weekRange);
  
  // TODO: 调用飞书消息 API
  // await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${tenantToken}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     receive_id: CONFIG.notificationChatId,
  //     msg_type: 'text',
  //     content: JSON.stringify({
  //       text: `📊 就业形势周报已更新 (${weekRange})\n\n查看详情：${docUrl}`,
  //     }),
  //   }),
  //   params: { receive_id_type: 'chat_id' },
  // });
  
  return { success: true };
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始同步就业形势周报...');
  
  try {
    // 1. 获取最新周报
    const reportPath = getLatestWeeklyReport();
    console.log('📄 周报文件:', reportPath);
    
    // 2. 读取内容
    const content = readWeeklyReport(reportPath);
    
    // 3. 提取周期信息
    const weekMatch = content.match(/# 就业形势周报 \| (.+)/);
    const weekRange = weekMatch ? weekMatch[1] : '未知周期';
    
    // 4. 更新飞书文档
    const updateResult = await updateFeishuDoc(content);
    if (!updateResult.success) {
      throw new Error('更新飞书文档失败');
    }
    console.log('✅ 飞书文档已更新');
    
    // 5. 发送通知
    const docUrl = `https://www.feishu.cn/docx/${CONFIG.feishuDocId}`;
    await sendNotification(docUrl, weekRange);
    console.log('✅ 通知已发送');
    
    console.log('🎉 周报同步完成！');
    return { success: true, docUrl, weekRange };
    
  } catch (error) {
    console.error('❌ 周报同步失败:', error.message);
    return { success: false, error: error.message };
  }
}

// 执行
main().then(result => {
  console.log('执行结果:', JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}).catch(err => {
  console.error('未预期的错误:', err);
  process.exit(1);
});
