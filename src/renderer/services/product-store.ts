/**
 * 产品规则库存储层 — 基于 lowdb LocalStorage 的 CRUD
 *
 * 设计原则：
 * - 同步读写，简单可靠
 * - 数据存在 localStorage，Electron 环境下持久化
 * - 接口简洁，方便后续替换为其他存储方案
 */

import { LocalStoragePreset } from 'lowdb/browser';
import type { LowSync } from 'lowdb';
import type { ProductRule } from '../types/product-rule';

const STORAGE_KEY = 'credit-product-rules';

interface StoreData {
  products: ProductRule[];
}

let db: LowSync<StoreData> | null = null;

/** 获取 db 实例（懒初始化） */
function getDb(): LowSync<StoreData> {
  if (!db) {
    db = LocalStoragePreset<StoreData>(STORAGE_KEY, { products: [] });
  }
  return db;
}

/** 生成简易唯一 ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 获取所有产品规则 */
export function getAllProducts(): ProductRule[] {
  const d = getDb();
  d.read();
  return d.data.products;
}

/** 根据 ID 获取单个产品 */
export function getProductById(id: string): ProductRule | undefined {
  return getAllProducts().find(p => p.id === id);
}

/** 新增产品规则 */
export function addProduct(product: Omit<ProductRule, 'id' | 'createdAt' | 'updatedAt'>): ProductRule {
  const d = getDb();
  d.read();
  const now = new Date().toISOString();
  const newProduct: ProductRule = {
    ...product,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  d.data.products.push(newProduct);
  d.write();
  return newProduct;
}

/** 更新产品规则 */
export function updateProduct(id: string, updates: Partial<Omit<ProductRule, 'id' | 'createdAt'>>): ProductRule | null {
  const d = getDb();
  d.read();
  const idx = d.data.products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  d.data.products[idx] = {
    ...d.data.products[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  d.write();
  return d.data.products[idx];
}

/** 删除产品规则 */
export function deleteProduct(id: string): boolean {
  const d = getDb();
  d.read();
  const before = d.data.products.length;
  d.data.products = d.data.products.filter(p => p.id !== id);
  if (d.data.products.length === before) return false;
  d.write();
  return true;
}

/** 导出所有产品规则（JSON 字符串，方便用户备份） */
export function exportProducts(): string {
  return JSON.stringify(getAllProducts(), null, 2);
}

/** 导入产品规则（合并，不覆盖已有同 ID 的） */
export function importProducts(json: string): number {
  const d = getDb();
  d.read();
  const imported: ProductRule[] = JSON.parse(json);
  const existingIds = new Set(d.data.products.map(p => p.id));
  let count = 0;
  for (const p of imported) {
    if (!existingIds.has(p.id)) {
      d.data.products.push(p);
      count++;
    }
  }
  if (count > 0) d.write();
  return count;
}

