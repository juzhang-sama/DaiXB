/**
 * 贷款产品规则库 — 类型定义
 *
 * 设计原则：
 * - 条件字段（零件）由我们预定义，用户从中选择组装产品
 * - 每个条件独立，未选中的条件匹配时跳过
 * - 预留扩展：新增字段只需在 CONDITION_CATALOG 中添加
 */

/** 条件比较方式 */
export type ConditionOperator = 'range' | 'bool' | 'enum';

/** 单个条件规则 — 产品的"零件" */
export interface ConditionRule {
  /** 对应 CreditProfile 的字段路径，如 'basicAccess.age' */
  field: string;
  /** 比较方式 */
  operator: ConditionOperator;
  /** 显示名称 */
  label: string;
  /** 权重（所有条件权重之和必须等于 100） */
  weight: number;
  /** 数值范围下限（range 用） */
  min?: number;
  /** 数值范围上限（range 用） */
  max?: number;
  /** 布尔值（bool 用） */
  value?: boolean;
  /** 允许的枚举值列表（enum 用） */
  values?: string[];
}

/** 产品规则 */
export interface ProductRule {
  /** 唯一标识 */
  id: string;
  /** 产品名称 */
  name: string;
  /** 机构名称 */
  institution: string;
  /** 额度范围 [min, max]（万元） */
  amountRange: [number, number];
  /** 利率范围 [min, max]（年化%） */
  rateRange: [number, number];
  /** 备注 */
  remark: string;
  /** 用户选择的准入条件列表 */
  conditions: ConditionRule[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** 条件目录项 — 预定义的"零件"模板 */
export interface ConditionCatalogItem {
  /** 字段路径 */
  field: string;
  /** 显示名称 */
  label: string;
  /** 所属维度 */
  dimension: string;
  /** 默认比较方式 */
  operator: ConditionOperator;
  /** range 类型的建议默认值 */
  defaultMin?: number;
  defaultMax?: number;
  /** bool 类型的默认值 */
  defaultValue?: boolean;
  /** enum 类型的可选值列表 */
  enumOptions?: string[];
}

/**
 * 预定义条件目录 — 所有可用的"零件"
 * 用户创建产品时从中选择
 * 后续新增字段只需在此追加
 */
export const CONDITION_CATALOG: ConditionCatalogItem[] = [
  // ── 维度一：基础准入 ──
  { field: 'basicAccess.age', label: '年龄', dimension: '基础准入', operator: 'range', defaultMin: 22, defaultMax: 55 },
  { field: 'basicAccess.marriage', label: '婚姻状况', dimension: '基础准入', operator: 'enum', enumOptions: ['已婚', '未婚', '离异', '丧偶'] },
  { field: 'basicAccess.employmentStatus', label: '就业状况', dimension: '基础准入', operator: 'enum', enumOptions: ['在职', '自由职业', '退休', '无业'] },

  // ── 维度二：征信硬伤 ──
  { field: 'hardInjury.currentOverdueCount', label: '当前逾期笔数', dimension: '征信硬伤', operator: 'range', defaultMin: 0, defaultMax: 0 },
  { field: 'hardInjury.maxConsecutiveOverdue', label: '最大连续逾期期数', dimension: '征信硬伤', operator: 'range', defaultMin: 0, defaultMax: 2 },
  { field: 'hardInjury.totalOverdueIn2Years', label: '近2年累计逾期次数', dimension: '征信硬伤', operator: 'range', defaultMin: 0, defaultMax: 5 },
  { field: 'hardInjury.hasBadDebt', label: '是否有呆账', dimension: '征信硬伤', operator: 'bool', defaultValue: false },
  { field: 'hardInjury.hasCompensation', label: '是否有代偿', dimension: '征信硬伤', operator: 'bool', defaultValue: false },

  // ── 维度三：负债状况 ──
  { field: 'debtStatus.activeLoanCount', label: '在贷笔数', dimension: '负债状况', operator: 'range', defaultMin: 0, defaultMax: 8 },
  { field: 'debtStatus.cardUsageRate', label: '信用卡使用率', dimension: '负债状况', operator: 'range', defaultMin: 0, defaultMax: 0.7 },
  { field: 'debtStatus.newLoanIn6Months', label: '近6月新增贷款', dimension: '负债状况', operator: 'range', defaultMin: 0, defaultMax: 3 },
  { field: 'debtStatus.totalMonthlyPayment', label: '月供合计(元)', dimension: '负债状况', operator: 'range', defaultMin: 0, defaultMax: 20000 },
  { field: 'debtStatus.totalLoanBalance', label: '贷款总余额(元)', dimension: '负债状况', operator: 'range', defaultMin: 0, defaultMax: 500000 },

  // ── 维度四：查询频次 ──
  { field: 'queryFrequency.queryIn1Month', label: '近1月查询次数', dimension: '查询频次', operator: 'range', defaultMin: 0, defaultMax: 3 },
  { field: 'queryFrequency.queryIn3Months', label: '近3月查询次数', dimension: '查询频次', operator: 'range', defaultMin: 0, defaultMax: 6 },
  { field: 'queryFrequency.queryIn6Months', label: '近6月查询次数', dimension: '查询频次', operator: 'range', defaultMin: 0, defaultMax: 10 },

  // ── 维度五：资产状况 ──
  { field: 'assetStatus.hasMortgage', label: '是否有房贷', dimension: '资产状况', operator: 'bool', defaultValue: true },
  { field: 'assetStatus.hasAutoLoan', label: '是否有车贷', dimension: '资产状况', operator: 'bool', defaultValue: true },
  { field: 'assetStatus.totalCardCreditLimit', label: '信用卡总授信(元)', dimension: '资产状况', operator: 'range', defaultMin: 0, defaultMax: 200000 },

  // ── 维度六：信用历史 ──
  { field: 'creditHistory.creditYears', label: '信用年限(年)', dimension: '信用历史', operator: 'range', defaultMin: 1, defaultMax: 30 },
  { field: 'creditHistory.settledLoanCount', label: '已结清贷款笔数', dimension: '信用历史', operator: 'range', defaultMin: 0, defaultMax: 20 },
];

