#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KV_NAMESPACE_NAME = 'SUBMGR_KV';
const WRANGLER_CONFIG_PATH = path.join(__dirname, '..', 'wrangler.jsonc');

// 执行wrangler命令并返回结果
function runWranglerCommand(command) {
  try {
    return execSync(`npx wrangler ${command}`, { encoding: 'utf8' });
  } catch (error) {
    console.error(`执行命令失败: npx wrangler ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

// 检查KV namespace是否存在
function checkKvNamespaceExists() {
  console.log(`正在检查KV namespace "${KV_NAMESPACE_NAME}"是否存在...`);
  const output = runWranglerCommand('kv namespace list');
  
  try {
    // 尝试从输出中提取JSON部分（如果有）
    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const namespaces = JSON.parse(jsonMatch[0]);
      return namespaces.find(ns => ns.title === KV_NAMESPACE_NAME);
    }
    
    // 如果没有匹配到JSON格式，就使用正则表达式查找namespace
    const namespaceRegex = new RegExp(`"${KV_NAMESPACE_NAME}"\\s*([a-zA-Z0-9-]+)`);
    const match = output.match(namespaceRegex);
    
    if (match) {
      return { 
        title: KV_NAMESPACE_NAME, 
        id: match[1] 
      };
    }
    
    return null;
  } catch (error) {
    console.error('解析KV namespace列表失败:', error.message);
    console.error('原始输出:', output);
    return null;
  }
}

// 创建KV namespace
function createKvNamespace() {
  console.log(`创建KV namespace "${KV_NAMESPACE_NAME}"...`);
  const output = runWranglerCommand(`kv namespace create "${KV_NAMESPACE_NAME}"`);
  
  try {
    // 尝试从输出中提取ID
    const idMatch = output.match(/id\s*=\s*"([^"]+)"/);
    if (idMatch) {
      return { 
        title: KV_NAMESPACE_NAME, 
        id: idMatch[1] 
      };
    } else {
      throw new Error('无法从输出中提取KV namespace ID');
    }
  } catch (error) {
    console.error('解析创建KV namespace结果失败:', error.message);
    console.error('原始输出:', output);
    process.exit(1);
  }
}

// 更新wrangler.jsonc文件
function updateWranglerConfig(kvNamespaceId) {
  console.log(`更新wrangler.jsonc文件...`);
  
  try {
    let config = fs.readFileSync(WRANGLER_CONFIG_PATH, 'utf8');
    
    // Parse the JSONC (removing comments first)
    const configWithoutComments = config.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const jsonConfig = JSON.parse(configWithoutComments);
    
    // Update or add KV namespace configuration
    jsonConfig.kv_namespaces = [{
      binding: "SUBMGR_KV",
      id: kvNamespaceId
    }];
    
    // Write back the config with proper formatting
    fs.writeFileSync(WRANGLER_CONFIG_PATH, JSON.stringify(jsonConfig, null, '\t'));
    console.log('wrangler.jsonc文件已更新');
  } catch (error) {
    console.error('更新wrangler.jsonc文件失败:', error.message);
    process.exit(1);
  }
}

// 主函数
function main() {
  console.log('开始设置KV namespace...');
  
  // 检查KV namespace是否存在
  let namespace = checkKvNamespaceExists();
  
  // 如果不存在，则创建
  if (!namespace) {
    console.log(`KV namespace "${KV_NAMESPACE_NAME}"不存在，正在创建...`);
    namespace = createKvNamespace();
    console.log(`KV namespace "${KV_NAMESPACE_NAME}"创建成功，ID: ${namespace.id}`);
  } else {
    console.log(`KV namespace "${KV_NAMESPACE_NAME}"已存在，ID: ${namespace.id}`);
  }
  
  // 更新wrangler.jsonc文件
  updateWranglerConfig(namespace.id);
  
  console.log('设置完成！');
}

main(); 