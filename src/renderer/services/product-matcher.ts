/**
 * 产品匹配引擎 — 将 CreditProfile 与产品规则逐条比对
 *
 * 设计原则：
 * - 未选中的条件直接跳过（不同产品侧重点不同）
 * - 字段值为 null 时标记"数据不足"而非直接判定不通过
 * - 输出每个条件的匹配明细，方便 UI 展示
 * - 预留 LLM 接口：匹配结果为标准 JSON，可直接喂给大模型做分析
 */

import type { CreditProfile } from '../types/credit-profile';
import type { ProductRule, ConditionRule } from '../types/product-rule';

/** 单条件匹配状态 */
export type ConditionStatus = 'pass' | 'fail' | 'insufficient';

/** 单条件匹配结果 */
export interface ConditionMatchResult {
  /** 条件显示名 */
  label: string;
  /** 字段路径 */
  field: string;
  /** 匹配状态 */
  status: ConditionStatus;
  /** 实际值（展示用） */
  actual: string;
  /** 要求描述（展示用） */
  expected: string;
}

/** 单产品匹配结果 */
export interface ProductMatchResult {
  /** 产品规则 */
  product: ProductRule;
  /** 预估成功率百分比（0-100） */
  successRate: number;
  /** 各条件匹配明细 */
  details: ConditionMatchResult[];
  /** 通过条件数 */
  passCount: number;
  /** 不通过条件数 */
  failCount: number;
  /** 数据不足条件数 */
  insufficientCount: number;
}

/** 从 CreditProfile 中按字段路径取值 */
function getFieldValue(profile: CreditProfile, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let current: unknown = profile;
  for (const part of parts) {
    if (current === null || current === undefined) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** 格式化实际值用于展示 */
function formatActual(value: unknown): string {
  if (value === null || value === undefined) return '数据不足';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') {
    if (value >= 0 && value <= 1 && value !== 0 && value !== 1) {
      return `${Math.round(value * 100)}%`;
    }
    return value.toLocaleString('zh-CN');
  }
  return String(value);
}

/** 格式化期望值用于展示 */
function formatExpected(rule: ConditionRule): string {
  if (rule.operator === 'range') {
    const parts: string[] = [];
    if (rule.min !== undefined) parts.push(`≥ ${rule.min}`);
    if (rule.max !== undefined) parts.push(`≤ ${rule.max}`);
    return parts.join(' 且 ') || '无限制';
  }
  if (rule.operator === 'bool') {
    return rule.value ? '是' : '否';
  }
  if (rule.operator === 'enum') {
    return rule.values?.join(' / ') ?? '无限制';
  }
  return '未知';
}

/** 匹配单个条件 */
function matchCondition(profile: CreditProfile, rule: ConditionRule): ConditionMatchResult {
  const value = getFieldValue(profile, rule.field);
  const actual = formatActual(value);
  const expected = formatExpected(rule);

  // 数据不足
  if (value === null || value === undefined) {
    return { label: rule.label, field: rule.field, status: 'insufficient', actual, expected };
  }

  let pass = true;

  if (rule.operator === 'range') {
    const num = typeof value === 'number' ? value : NaN;
    if (isNaN(num)) {
      return { label: rule.label, field: rule.field, status: 'insufficient', actual, expected };
    }
    if (rule.min !== undefined && num < rule.min) pass = false;
    if (rule.max !== undefined && num > rule.max) pass = false;
  }

  if (rule.operator === 'bool') {
    pass = value === rule.value;
  }

  if (rule.operator === 'enum') {
    pass = rule.values?.includes(String(value)) ?? true;
  }

  return {
    label: rule.label, field: rule.field,
    status: pass ? 'pass' : 'fail', actual, expected,
  };
}

/** 匹配单个产品，按权重加权计算预估成功率 */
export function matchProduct(profile: CreditProfile, product: ProductRule): ProductMatchResult {
  const details = product.conditions.map(c => matchCondition(profile, c));
  const passCount = details.filter(d => d.status === 'pass').length;
  const failCount = details.filter(d => d.status === 'fail').length;
  const insufficientCount = details.filter(d => d.status === 'insufficient').length;

  const totalWeight = product.conditions.reduce((s, c) => s + c.weight, 0);

  let earned = 0;
  for (let i = 0; i < details.length; i++) {
    const w = product.conditions[i].weight;
    if (details[i].status === 'pass') earned += w;
    else if (details[i].status === 'insufficient') earned += w * 0.5;
  }

  // 权重总和为 0（无条件或全部权重为 0）时视为完全匹配
  const successRate = totalWeight > 0 ? Math.round(earned / totalWeight * 100) : 100;

  return { product, successRate, details, passCount, failCount, insufficientCount };
}

/** 批量匹配所有产品，按匹配度降序排序 */
export function matchAllProducts(
  profile: CreditProfile, products: ProductRule[],
): ProductMatchResult[] {
  return products
    .map(p => matchProduct(profile, p))
    .sort((a, b) => b.successRate - a.successRate);
}

