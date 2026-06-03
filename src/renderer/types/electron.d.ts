import type { DocParserResult } from '../../shared/doc-parser-types';

/** 渲染进程中 window.electron 的类型声明 */
interface ElectronAPI {
  platform: string;
  /** 调用主进程 TextIn 文档解析 */
  parseDocument: (fileBase64: string, fileName: string) => Promise<DocParserResult>;
  /** 调用主进程 DeepSeek LLM */
  llmChat: (messages: { role: string; content: string }[]) => Promise<string>;
  /** 获取已保存的 API Key */
  getApiKeys: () => Promise<Record<string, string>>;
  /** 保存 API Key */
  setApiKeys: (keys: Record<string, string>) => Promise<void>;
  /** 检查 API Key 是否已配置 */
  hasApiKeys: () => Promise<boolean>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};

