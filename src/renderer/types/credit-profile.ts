/**
 * 个人征信画像 — 从 CreditReport 派生的六维度评估数据
 *
 * 设计原则：
 * - 每个维度独立，方便后续单独扩展或替换评分逻辑
 * - 所有数值字段允许 null，表示"数据不足，无法计算"
 * - repaymentRecords 相关字段（连三累六）预留，当前 OCR 无法提取时为 null
 */

/** 维度一：基础准入 */
export interface BasicAccess {
  age: number | null;
  marriage: string | null;
  employmentStatus: string | null;
  registeredAddress: string | null;
}

/** 维度二：征信硬伤（仅标注，不做一票否决） */
export interface HardInjury {
  /** 当前逾期笔数（所有账户合计） */
  currentOverdueCount: number;
  /** 近2年最大连续逾期期数（还款记录派生，OCR 不足时为 null） */
  maxConsecutiveOverdue: number | null;
  /** 近2年累计逾期次数（还款记录派生，OCR 不足时为 null） */
  totalOverdueIn2Years: number | null;
  /** 是否有呆账（五级分类含"损失"或状态含"呆账"） */
  hasBadDebt: boolean;
  /** 是否有代偿记录 */
  hasCompensation: boolean;
}

/** 维度三：负债状况 */
export interface DebtStatus {
  /** 贷款总余额（元） */
  totalLoanBalance: number;
  /** 信用卡已用额度合计（元） */
  totalCardUsed: number;
  /** 信用卡使用率（已用/总授信，0-1） */
  cardUsageRate: number | null;
  /** 在贷贷款笔数 */
  activeLoanCount: number;
  /** 近6个月新开贷款笔数 */
  newLoanIn6Months: number;
  /** 月供合计（元） */
  totalMonthlyPayment: number;
}

/** 维度四：查询频次（仅计贷款审批/信用卡审批/担保资格审查） */
export interface QueryFrequency {
  queryIn1Month: number | null;
  queryIn3Months: number | null;
  queryIn6Months: number | null;
}

/** 维度五：资产状况 */
export interface AssetStatus {
  /** 是否有房贷记录 */
  hasMortgage: boolean;
  /** 是否有车贷记录 */
  hasAutoLoan: boolean;
  /** 信用卡总授信额度（元） */
  totalCardCreditLimit: number;
}

/** 维度六：信用历史 */
export interface CreditHistory {
  /** 最早开户日期（所有账户中最早的 openDate） */
  earliestOpenDate: string | null;
  /** 信用历史年限（从最早开户到现在） */
  creditYears: number | null;
  /** 已结清贷款笔数 */
  settledLoanCount: number;
}

/** 完整的六维度征信画像 */
export interface CreditProfile {
  basicAccess: BasicAccess;
  hardInjury: HardInjury;
  debtStatus: DebtStatus;
  queryFrequency: QueryFrequency;
  assetStatus: AssetStatus;
  creditHistory: CreditHistory;
}

