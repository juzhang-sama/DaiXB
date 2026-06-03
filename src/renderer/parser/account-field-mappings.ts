/**
 * 四种账户类型的字段映射配置
 * 
 * 设计原则：
 * 1. 每种账户类型独立配置，字段名称与 PDF 表格完全一致
 * 2. 当前只实现汇总计算需要的核心字段，其他字段预留位置
 * 3. 后续新增字段只需在配置中添加，不改核心逻辑
 */

/** 字段映射配置类型 */
export interface AccountFieldMapping {
  // === 核心字段（汇总计算必需）===
  org: string;            // 机构名称
  creditAmount: string;   // 授信/借款金额
  balance: string;        // 余额/已用额度
  monthlyPayment: string; // 本月应还款
  accountStatus: string;  // 账户状态（判断是否结清）

  // === 基础信息字段 ===
  accountLabel?: string;      // 账户标识
  openDate?: string;          // 开立日期
  endDate?: string;           // 到期日期
  currency?: string;          // 币种
  accountType?: string;       // 账户类型/业务种类
  guaranteeType?: string;     // 担保方式

  // === 状态与分类字段 ===
  fiveCategory?: string;      // 五级分类
  
  // === 还款相关字段 ===
  remainingPeriods?: string;  // 剩余还款期数
  dueDate?: string;           // 应还款日/账单日
  actualPayment?: string;     // 本月实还款
  lastPaymentDate?: string;   // 最近一次还款日期

  // === 逾期相关字段 ===
  currentOverduePeriods?: string;  // 当前逾期期数
  currentOverdueAmount?: string;   // 当前逾期总额

  // === 信用卡特有字段 ===
  sharedCreditLimit?: string;    // 共享授信额度
  usedCreditLimit?: string;      // 已用额度
  unpostedLargeAmount?: string;  // 未出单的大额专项分期余额
  installmentBalance?: string;   // 剩余分期期数
  avgUsed6m?: string;            // 最近6个月平均使用额度
  maxCreditLimit?: string;       // 最大使用额度
}

/** 账户类型枚举 */
export type AccountCategory = 'nonRevolvingLoan' | 'revolvingLoan1' | 'revolvingLoan2' | 'creditCard';

/** 非循环贷账户字段映射 */
const NON_REVOLVING_LOAN_FIELDS: AccountFieldMapping = {
  // 核心字段
  org: '管理机构',
  creditAmount: '借款金额',
  balance: '余额',
  monthlyPayment: '本月应还款',
  accountStatus: '账户状态',
  // 基础信息
  accountLabel: '账户标识',
  openDate: '开立日期',
  endDate: '到期日期',
  currency: '币种',
  accountType: '账户类型',
  guaranteeType: '担保方式',
  // 状态与分类
  fiveCategory: '五级分类',
  // 还款相关
  remainingPeriods: '剩余还款期数',
  dueDate: '应还款日',
  actualPayment: '本月实还款',
  lastPaymentDate: '最近一次还款日期',
  // 逾期相关
  currentOverduePeriods: '当前逾期期数',
  currentOverdueAmount: '当前逾期总额',
};

/** 循环贷账户一字段映射（与非循环贷相同） */
const REVOLVING_LOAN1_FIELDS: AccountFieldMapping = {
  ...NON_REVOLVING_LOAN_FIELDS,
};

/** 循环贷账户二字段映射 */
const REVOLVING_LOAN2_FIELDS: AccountFieldMapping = {
  ...NON_REVOLVING_LOAN_FIELDS,
  // 循环贷二的授信字段不同
  creditAmount: '账户授信额度',
};

/** 贷记卡（信用卡）账户字段映射 */
const CREDIT_CARD_FIELDS: AccountFieldMapping = {
  // 核心字段
  org: '发卡机构',
  creditAmount: '账户授信额度',
  balance: '已用额度',
  monthlyPayment: '本月应还款',
  accountStatus: '账户状态',
  // 基础信息
  accountLabel: '账户标识',
  openDate: '开立日期',
  currency: '币种',
  accountType: '业务种类',
  guaranteeType: '担保方式',
  // 还款相关
  dueDate: '账单日',
  actualPayment: '本月实还款',
  lastPaymentDate: '最近一次还款日期',
  // 逾期相关
  currentOverduePeriods: '当前逾期期数',
  currentOverdueAmount: '当前逾期总额',
  // 信用卡特有
  sharedCreditLimit: '共享授信额度',
  usedCreditLimit: '已用额度',
  unpostedLargeAmount: '未出单的大额专项分期余额',
  installmentBalance: '剩余分期期数',
  avgUsed6m: '最近6个月平均使用额度',
  maxCreditLimit: '最大使用额度',
};

/** 字段映射配置表 */
export const ACCOUNT_FIELD_MAPPINGS: Record<AccountCategory, AccountFieldMapping> = {
  nonRevolvingLoan: NON_REVOLVING_LOAN_FIELDS,
  revolvingLoan1: REVOLVING_LOAN1_FIELDS,
  revolvingLoan2: REVOLVING_LOAN2_FIELDS,
  creditCard: CREDIT_CARD_FIELDS,
};

/** 根据账户类型获取字段映射 */
export function getFieldMapping(category: AccountCategory): AccountFieldMapping {
  return ACCOUNT_FIELD_MAPPINGS[category];
}

