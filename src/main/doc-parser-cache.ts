import { app } from 'electron';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { DocParserResult } from '../shared/doc-parser-types';
import { debugLog, logError } from './logger';

const CACHE_DIR_NAME = 'doc-parser-cache';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 获取缓存目录路径，不存在则创建 */
async function ensureCacheDir(): Promise<string> {
  const cacheDir = path.join(app.getPath('userData'), CACHE_DIR_NAME);
  await fs.mkdir(cacheDir, { recursive: true });
  return cacheDir;
}

/** 根据文件内容生成 SHA-256 哈希作为缓存 key */
function computeHash(fileBase64: string): string {
  return createHash('sha256').update(fileBase64).digest('hex');
}

/** 缓存文件路径 */
async function getCachePath(fileBase64: string): Promise<string> {
  const dir = await ensureCacheDir();
  const hash = computeHash(fileBase64);
  return path.join(dir, `${hash}.json`);
}

/**
 * 从缓存读取 DocParserResult
 * 命中返回结果，未命中返回 null
 */
export async function readCache(fileBase64: string): Promise<DocParserResult | null> {
  try {
    const filePath = await getCachePath(fileBase64);
    const stat = await fs.stat(filePath);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
      await fs.rm(filePath, { force: true });
      debugLog('[DocParserCache] expired cache removed');
      return null;
    }
    const data = await fs.readFile(filePath, 'utf-8');
    debugLog('[DocParserCache] cache hit');
    return JSON.parse(data) as DocParserResult;
  } catch {
    return null;
  }
}

/**
 * 将 DocParserResult 写入缓存
 */
export async function writeCache(
  fileBase64: string, result: DocParserResult,
): Promise<void> {
  try {
    const filePath = await getCachePath(fileBase64);
    await fs.writeFile(filePath, JSON.stringify(result), 'utf-8');
    debugLog('[DocParserCache] cached');
  } catch (err) {
    logError('[DocParserCache] write failed:', err);
  }
}

/** 删除所有 OCR 文档解析缓存 */
export async function clearCache(): Promise<number> {
  const cacheDir = await ensureCacheDir();
  const files = await fs.readdir(cacheDir).catch(() => []);
  let removed = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    await fs.rm(path.join(cacheDir, file), { force: true });
    removed++;
  }
  return removed;
}

/** 获取缓存统计信息 */
export async function getCacheStats(): Promise<{ count: number; bytes: number }> {
  const cacheDir = await ensureCacheDir();
  const files = await fs.readdir(cacheDir).catch(() => []);
  let count = 0;
  let bytes = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const stat = await fs.stat(path.join(cacheDir, file)).catch(() => null);
    if (!stat) continue;
    count++;
    bytes += stat.size;
  }
  return { count, bytes };
}
