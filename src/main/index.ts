import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { parseDocument } from './textin-ocr';
import { chatCompletion } from './deepseek-client';
import { getApiKeys, setApiKeys, hasApiKeys } from './api-key-store';
import { loadTextinConfig } from './textin-config';
import { loadDeepseekConfig } from './deepseek-config';
import { clearCache, getCacheStats } from './doc-parser-cache';

const isDev = !app.isPackaged;
const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5175';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL(rendererUrl);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }
}

// IPC：TextIn 文档解析
ipcMain.handle('ocr:parseDocument', async (_event, fileBase64: string, fileName: string) => {
  return parseDocument(fileBase64, fileName);
});

// IPC：DeepSeek LLM
ipcMain.handle('llm:chat', async (_event, messages: { role: string; content: string }[]) => {
  return chatCompletion(messages as { role: 'system' | 'user' | 'assistant'; content: string }[]);
});

// IPC：API Key 管理
ipcMain.handle('config:getKeys', async () => getApiKeys());
ipcMain.handle('config:setKeys', async (_event, keys: Record<string, string>) => {
  await setApiKeys(keys);
  await loadTextinConfig();
  await loadDeepseekConfig();
});
ipcMain.handle('config:hasKeys', async () => hasApiKeys());
ipcMain.handle('cache:clearDocParser', async () => clearCache());
ipcMain.handle('cache:getDocParserStats', async () => getCacheStats());

app.whenReady().then(async () => {
  await loadTextinConfig();
  await loadDeepseekConfig();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
