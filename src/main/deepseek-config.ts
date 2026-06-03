import { getApiKeys } from './api-key-store';

/** DeepSeek API 运行时配置，启动时从 api-key-store 加载 */
export const DEEPSEEK_CONFIG = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  maxTokens: 2048,
  temperature: 0.3,
};

/** 从持久化存储加载 DeepSeek Key */
export async function loadDeepseekConfig(): Promise<void> {
  const keys = await getApiKeys();
  DEEPSEEK_CONFIG.apiKey = keys.deepseekApiKey ?? '';
}

