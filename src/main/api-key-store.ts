/**
 * API Key 持久化存储 — 存储在 app.getPath('userData') 下的 JSON 文件
 *
 * 首次启动时文件不存在，由用户通过 SetupModal 输入后写入
 */

import { app, safeStorage } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_FILE = 'api-keys.json';

/** API Key 存储结构 */
export interface ApiKeyConfig {
  textinAppId?: string;
  textinSecretCode?: string;
  deepseekApiKey?: string;
}

type StoredSecret = string | { encrypted: true; value: string };

type StoredApiKeyConfig = Partial<Record<keyof ApiKeyConfig, StoredSecret>>;

/** 获取配置文件完整路径 */
function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

/** 读取所有 API Key */
export async function getApiKeys(): Promise<ApiKeyConfig> {
  try {
    const data = await fs.readFile(getConfigPath(), 'utf-8');
    return decryptConfig(JSON.parse(data) as StoredApiKeyConfig);
  } catch {
    return {};
  }
}

/** 写入 API Key（合并更新） */
export async function setApiKeys(keys: Record<string, string>): Promise<void> {
  const existing = await getApiKeys();
  const merged = { ...existing, ...keys };
  await fs.writeFile(getConfigPath(), JSON.stringify(encryptConfig(merged), null, 2), 'utf-8');
}

/** 检查必要的 API Key 是否都已配置 */
export async function hasApiKeys(): Promise<boolean> {
  const keys = await getApiKeys();
  return Boolean(
    keys.textinAppId && keys.textinSecretCode && keys.deepseekApiKey,
  );
}

function encryptConfig(config: ApiKeyConfig): StoredApiKeyConfig {
  return {
    textinAppId: encryptValue(config.textinAppId),
    textinSecretCode: encryptValue(config.textinSecretCode),
    deepseekApiKey: encryptValue(config.deepseekApiKey),
  };
}

function decryptConfig(config: StoredApiKeyConfig): ApiKeyConfig {
  return {
    textinAppId: decryptValue(config.textinAppId),
    textinSecretCode: decryptValue(config.textinSecretCode),
    deepseekApiKey: decryptValue(config.deepseekApiKey),
  };
}

function encryptValue(value: string | undefined): StoredSecret | undefined {
  if (!value) return value;
  if (!safeStorage.isEncryptionAvailable()) return value;
  return {
    encrypted: true,
    value: safeStorage.encryptString(value).toString('base64'),
  };
}

function decryptValue(value: StoredSecret | undefined): string | undefined {
  if (!value) return value;
  if (typeof value === 'string') return value;
  try {
    return safeStorage.decryptString(Buffer.from(value.value, 'base64'));
  } catch {
    return '';
  }
}
