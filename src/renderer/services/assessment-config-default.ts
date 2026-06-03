/**
 * 征信评估默认配置 — 风险等级阈值（无权重、无评分）
 *
 * 四级风险：正常 → 关注 → 警告 → 危险
 * 每个指标独立判定风险等级，不做加权汇总
 * 独立文件，方便后续替换为用户自定义配置
 */

/** 风险等级 */
export type RiskLevel = '正常' | '关注' | '警告' | '危险';

/** 递增阈值：值 ≤ max 时为该等级（从低到高排列） */
export interface LevelBound {
  max: number;
  level: RiskLevel;
}

/** 完整评估配置 */
export interface AssessmentConfig {
  /** 查询频次阈值（次数 → 风险等级） */
  query: {
    month1: LevelBound[];
    month3: LevelBound[];
    month6: LevelBound[];
  };
  /** 信用卡使用率阈值（0-1） */
  cardUsageRate: LevelBound[];
  /** 在贷笔数阈值 */
  activeLoanCount: LevelBound[];
  /** 近6月新增贷款笔数阈值 */
  newLoanIn6Months: LevelBound[];
  /** 信用年限阈值（年） */
  creditYears: LevelBound[];
}

export const DEFAULT_CONFIG: AssessmentConfig = {
  query: {
    month1: [
      { max: 2, level: '正常' },
      { max: 4, level: '关注' },
      { max: 6, level: '警告' },
      { max: Infinity, level: '危险' },
    ],
    month3: [
      { max: 4, level: '正常' },
      { max: 8, level: '关注' },
      { max: 12, level: '警告' },
      { max: Infinity, level: '危险' },
    ],
    month6: [
      { max: 6, level: '正常' },
      { max: 12, level: '关注' },
      { max: 18, level: '警告' },
      { max: Infinity, level: '危险' },
    ],
  },
  cardUsageRate: [
    { max: 0.3, level: '正常' },
    { max: 0.5, level: '关注' },
    { max: 0.7, level: '警告' },
    { max: Infinity, level: '危险' },
  ],
  activeLoanCount: [
    { max: 3, level: '正常' },
    { max: 6, level: '关注' },
    { max: 10, level: '警告' },
    { max: Infinity, level: '危险' },
  ],
  newLoanIn6Months: [
    { max: 1, level: '正常' },
    { max: 3, level: '关注' },
    { max: 5, level: '警告' },
    { max: Infinity, level: '危险' },
  ],
  creditYears: [
    { max: 1, level: '危险' },
    { max: 3, level: '警告' },
    { max: 5, level: '关注' },
    { max: Infinity, level: '正常' },
  ],
};

