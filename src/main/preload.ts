import { contextBridge, ipcRenderer } from 'electron';
import type { DocParserResult } from '../shared/doc-parser-types';

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  /** 调用主进程 TextIn 文档解析 */
  parseDocument: (fileBase64: string, fileName: string): Promise<DocParserResult> =>
    ipcRenderer.invoke('ocr:parseDocument', fileBase64, fileName),
  /** 调用主进程 DeepSeek LLM */
  llmChat: (messages: { role: string; content: string }[]): Promise<string> =>
    ipcRenderer.invoke('llm:chat', messages),
  /** 获取已保存的 API Key */
  getApiKeys: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('config:getKeys'),
  /** 保存 API Key */
  setApiKeys: (keys: Record<string, string>): Promise<void> =>
    ipcRenderer.invoke('config:setKeys', keys),
  /** 检查 API Key 是否已配置 */
  hasApiKeys: (): Promise<boolean> =>
    ipcRenderer.invoke('config:hasKeys'),
  /** 清理本地 OCR 文档解析缓存 */
  clearDocParserCache: (): Promise<number> =>
    ipcRenderer.invoke('cache:clearDocParser'),
  /** 获取 OCR 文档解析缓存统计 */
  getDocParserCacheStats: (): Promise<{ count: number; bytes: number }> =>
    ipcRenderer.invoke('cache:getDocParserStats'),
});
