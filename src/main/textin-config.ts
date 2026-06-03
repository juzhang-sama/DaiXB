import { getApiKeys } from './api-key-store';

/** TextIn API 运行时配置，启动时从 api-key-store 加载 */
export const TEXTIN_CONFIG = {
  appId: '',
  secretCode: '',
  parseUrl: 'https://api.textin.com/ai/service/v1/pdf_to_markdown',
};

/** 从持久化存储加载 TextIn Key，应在 app.whenReady 后调用 */
export async function loadTextinConfig(): Promise<void> {
  const keys = await getApiKeys();
  TEXTIN_CONFIG.appId = keys.textinAppId ?? '';
  TEXTIN_CONFIG.secretCode = keys.textinSecretCode ?? '';
}

