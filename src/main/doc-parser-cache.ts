import { app } from 'electron';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { DocParserResult } from '../shared/doc-parser-types';

const CACHE_DIR_NAME = 'doc-parser-cache';

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
    const data = await fs.readFile(filePath, 'utf-8');
    console.log('[DocParserCache] cache hit:', filePath);
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
    console.log('[DocParserCache] cached:', filePath);
  } catch (err) {
    console.error('[DocParserCache] write failed:', err);
  }
}

