/**
 * 征信评估引擎 — 六维度事实画像 + 风险等级标注
 *
 * 设计原则：
 * - 客观事实陈述，不做加权综合评分
 * - 每个维度独立输出关键指标 + 风险等级（正常/关注/警告/危险）
 * - 风险等级基于行业通用红线，不依赖产品权重
 * - 配置与逻辑分离，阈值可替换
 */

import type { CreditProfile } from '../types/credit-profile';
import type { AssessmentConfig, RiskLevel, LevelBound } from './assessment-config-default';
import { DEFAULT_CONFIG } from './assessment-config-default';

/** 单条事实指标 */
export interface Indicator {
  /** 指标名称 */
  label: string;
  /** 展示值（如 "8笔"、"72%"、"5次"） */
  display: string;
  /** 风险等级 */
  level: RiskLevel;
}

/** 单维度评估结果 */
export interface DimensionResult {
  /** 维度名称 */
  label: string;
  /** 维度整体风险等级（取该维度下最高风险） */
  level: RiskLevel;
  /** 关键指标列表 */
  indicators: Indicator[];
  /** 风险标签（简短文字提示） */
  tags: string[];
}

/** 完整评估结果 */
export interface AssessmentResult {
  /** 六维度评估详情 */
  dimensions: {
    basicAccess: DimensionResult;
    hardInjury: DimensionResult;
    debtStatus: DimensionResult;
    queryFrequency: DimensionResult;
    assetStatus: DimensionResult;
    creditHistory: DimensionResult;
  };
  /** 硬伤标注列表（展示用，不做否决） */
  hardInjuryTags: string[];
}

/** 执行征信评估 */
export function assessCredit(
  profile: CreditProfile, config: AssessmentConfig = DEFAULT_CONFIG,
): AssessmentResult {
  const dims = {
    basicAccess: assessBasicAccess(profile),
    hardInjury: assessHardInjury(profile),
    debtStatus: assessDebtStatus(profile, config),
    queryFrequency: assessQueryFrequency(profile, config),
    assetStatus: assessAssetStatus(profile),
    creditHistory: assessCreditHistory(profile, config),
  };

  return {
    dimensions: dims,
    hardInjuryTags: dims.hardInjury.tags,
  };
}

// ── 各维度评估函数 ──

function assessBasicAccess(p: CreditProfile): DimensionResult {
  const indicators: Indicator[] = [];
  const tags: string[] = [];
  const { age, marriage, employmentStatus } = p.basicAccess;

  if (age !== null) {
    const ageLevel: RiskLevel = (age >= 22 && age <= 55) ? '正常' : '关注';
    indicators.push({ label: '年龄', display: `${age}岁`, level: ageLevel });
    if (ageLevel !== '正常') tags.push(`年龄${age}岁（偏离22-55）`);
  } else {
    indicators.push({ label: '年龄', display: '未知', level: '关注' });
    tags.push('年龄未知');
  }

  indicators.push({
    label: '婚姻状况', display: marriage || '未知',
    level: marriage ? '正常' : '关注',
  });

  indicators.push({
    label: '就业状态', display: employmentStatus || '未知',
    level: (employmentStatus && employmentStatus !== '未知') ? '正常' : '关注',
  });

  return { label: '基础准入', level: worstLevel(indicators), indicators, tags };
}

function assessHardInjury(p: CreditProfile): DimensionResult {
  const indicators: Indicator[] = [];
  const tags: string[] = [];
  const hi = p.hardInjury;

  const overdueLevel: RiskLevel = hi.currentOverdueCount > 0 ? '危险' : '正常';
  indicators.push({ label: '当前逾期', display: `${hi.currentOverdueCount}笔`, level: overdueLevel });
  if (hi.currentOverdueCount > 0) tags.push(`当前逾期${hi.currentOverdueCount}笔`);

  indicators.push({ label: '呆账', display: hi.hasBadDebt ? '有' : '无', level: hi.hasBadDebt ? '危险' : '正常' });
  if (hi.hasBadDebt) tags.push('存在呆账');

  indicators.push({ label: '代偿', display: hi.hasCompensation ? '有' : '无', level: hi.hasCompensation ? '危险' : '正常' });
  if (hi.hasCompensation) tags.push('存在代偿记录');

  if (hi.maxConsecutiveOverdue !== null) {
    const lvl: RiskLevel = hi.maxConsecutiveOverdue >= 3 ? '危险' : '正常';
    indicators.push({ label: '最大连续逾期', display: `${hi.maxConsecutiveOverdue}期`, level: lvl });
    if (hi.maxConsecutiveOverdue >= 3) tags.push(`连续逾期${hi.maxConsecutiveOverdue}期（连三）`);
  } else {
    indicators.push({ label: '最大连续逾期', display: '数据不足', level: '关注' });
    tags.push('还款记录数据不足');
  }

  if (hi.totalOverdueIn2Years !== null) {
    const lvl: RiskLevel = hi.totalOverdueIn2Years >= 6 ? '危险' : hi.totalOverdueIn2Years >= 3 ? '警告' : '正常';
    indicators.push({ label: '近2年累计逾期', display: `${hi.totalOverdueIn2Years}次`, level: lvl });
    if (hi.totalOverdueIn2Years >= 6) tags.push(`累计逾期${hi.totalOverdueIn2Years}次（累六）`);
  } else {
    indicators.push({ label: '近2年累计逾期', display: '数据不足', level: '关注' });
  }

  return { label: '征信硬伤', level: worstLevel(indicators), indicators, tags };
}

function assessDebtStatus(p: CreditProfile, c: AssessmentConfig): DimensionResult {
  const indicators: Indicator[] = [];
  const tags: string[] = [];
  const ds = p.debtStatus;

  const loanLevel = matchLevel(ds.activeLoanCount, c.activeLoanCount);
  indicators.push({ label: '在贷笔数', display: `${ds.activeLoanCount}笔`, level: loanLevel });
  if (loanLevel === '警告' || loanLevel === '危险') tags.push(`在贷${ds.activeLoanCount}笔`);

  if (ds.cardUsageRate !== null) {
    const pct = Math.round(ds.cardUsageRate * 100);
    const usageLevel = matchLevel(ds.cardUsageRate, c.cardUsageRate);
    indicators.push({ label: '信用卡使用率', display: `${pct}%`, level: usageLevel });
    if (usageLevel === '警告' || usageLevel === '危险') tags.push(`使用率${pct}%`);
  } else {
    indicators.push({ label: '信用卡使用率', display: '无数据', level: '关注' });
  }

  const newLevel = matchLevel(ds.newLoanIn6Months, c.newLoanIn6Months);
  indicators.push({ label: '近6月新增贷款', display: `${ds.newLoanIn6Months}笔`, level: newLevel });
  if (newLevel === '警告' || newLevel === '危险') tags.push(`近6月新增${ds.newLoanIn6Months}笔`);

  indicators.push({ label: '贷款余额', display: `${ds.totalLoanBalance.toLocaleString('zh-CN')}元`, level: '正常' });
  indicators.push({ label: '月供合计', display: `${ds.totalMonthlyPayment.toLocaleString('zh-CN')}元`, level: '正常' });

  return { label: '负债状况', level: worstLevel(indicators), indicators, tags };
}

function assessQueryFrequency(p: CreditProfile, c: AssessmentConfig): DimensionResult {
  const indicators: Indicator[] = [];
  const tags: string[] = [];
  const qf = p.queryFrequency;

  if (qf.queryIn1Month !== null) {
    const lvl = matchLevel(qf.queryIn1Month, c.query.month1);
    indicators.push({ label: '近1月查询', display: `${qf.queryIn1Month}次`, level: lvl });
    if (lvl === '警告' || lvl === '危险') tags.push(`近1月查询${qf.queryIn1Month}次`);
  } else {
    indicators.push({ label: '近1月查询', display: '无数据', level: '关注' });
  }

  if (qf.queryIn3Months !== null) {
    const lvl = matchLevel(qf.queryIn3Months, c.query.month3);
    indicators.push({ label: '近3月查询', display: `${qf.queryIn3Months}次`, level: lvl });
    if (lvl === '警告' || lvl === '危险') tags.push(`近3月查询${qf.queryIn3Months}次`);
  } else {
    indicators.push({ label: '近3月查询', display: '无数据', level: '关注' });
  }

  if (qf.queryIn6Months !== null) {
    const lvl = matchLevel(qf.queryIn6Months, c.query.month6);
    indicators.push({ label: '近6月查询', display: `${qf.queryIn6Months}次`, level: lvl });
    if (lvl === '警告' || lvl === '危险') tags.push(`近6月查询${qf.queryIn6Months}次`);
  } else {
    indicators.push({ label: '近6月查询', display: '无数据', level: '关注' });
  }

  return { label: '查询频次', level: worstLevel(indicators), indicators, tags };
}

function assessAssetStatus(p: CreditProfile): DimensionResult {
  const indicators: Indicator[] = [];
  const tags: string[] = [];
  const as = p.assetStatus;

  indicators.push({ label: '房贷', display: as.hasMortgage ? '有' : '无', level: '正常' });
  if (as.hasMortgage) tags.push('有房贷记录');

  indicators.push({ label: '车贷', display: as.hasAutoLoan ? '有' : '无', level: '正常' });
  if (as.hasAutoLoan) tags.push('有车贷记录');

  const limit = as.totalCardCreditLimit;
  indicators.push({
    label: '信用卡总授信', display: `${limit.toLocaleString('zh-CN')}元`,
    level: limit >= 50000 ? '正常' : limit >= 20000 ? '关注' : '警告',
  });
  if (limit >= 50000) tags.push('授信较高');

  return { label: '资产状况', level: worstLevel(indicators), indicators, tags };
}

function assessCreditHistory(p: CreditProfile, c: AssessmentConfig): DimensionResult {
  const indicators: Indicator[] = [];
  const tags: string[] = [];
  const ch = p.creditHistory;

  if (ch.creditYears !== null) {
    const lvl = matchLevelReversed(ch.creditYears, c.creditYears);
    indicators.push({ label: '信用年限', display: `${ch.creditYears}年`, level: lvl });
    if (ch.creditYears < 1) tags.push('信用历史不足1年');
  } else {
    indicators.push({ label: '信用年限', display: '无数据', level: '关注' });
    tags.push('无法计算信用年限');
  }

  indicators.push({ label: '已结清贷款', display: `${ch.settledLoanCount}笔`, level: '正常' });
  if (ch.settledLoanCount >= 3) tags.push(`已结清${ch.settledLoanCount}笔`);

  if (ch.earliestOpenDate) {
    indicators.push({ label: '最早开户', display: ch.earliestOpenDate, level: '正常' });
  }

  return { label: '信用历史', level: worstLevel(indicators), indicators, tags };
}

// ── 工具函数 ──

const RISK_ORDER: Record<RiskLevel, number> = { '正常': 0, '关注': 1, '警告': 2, '危险': 3 };

/** 取指标列表中最高风险等级 */
function worstLevel(indicators: Indicator[]): RiskLevel {
  let worst: RiskLevel = '正常';
  for (const ind of indicators) {
    if (RISK_ORDER[ind.level] > RISK_ORDER[worst]) worst = ind.level;
  }
  return worst;
}

/** 按递增阈值匹配风险等级（值越大风险越高） */
function matchLevel(value: number, bounds: LevelBound[]): RiskLevel {
  for (const b of bounds) {
    if (value <= b.max) return b.level;
  }
  return '危险';
}

/** 按递增阈值匹配风险等级（值越小风险越高，如信用年限） */
function matchLevelReversed(value: number, bounds: LevelBound[]): RiskLevel {
  for (const b of bounds) {
    if (value <= b.max) return b.level;
  }
  return '正常';
}
