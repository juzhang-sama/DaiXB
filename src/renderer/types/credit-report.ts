/**
 * 央行二代个人征信报告 — 完整数据结构定义
 *
 * 设计原则：
 * 1. 严格对照央行二代征信报告的固定格式，一个模块一个接口
 * 2. 所有金额单位为"元"（人民币），前端展示时再做转换
 * 3. 日期统一用 string（原始格式如 "2025.01.20"），不做 Date 转换
 * 4. 可选字段用 null 表示"报告中未出现"，用 undefined 表示"解析失败"
 */

// ============================================================
// 顶层结构
// ============================================================

/** 按类别聚合的账户反算汇总 */
export interface AccountDerivedSummary {
  orgCount: number;
  accountCount: number;
  totalCredit: number;
  balance: number;
  monthlyPayment: number;
}

/** 各类别的反算汇总映射 */
export interface AccountDerivedMap {
  nonRevolvingLoan?: AccountDerivedSummary;
  revolvingLoan1?: AccountDerivedSummary;
  revolvingLoan2?: AccountDerivedSummary;
  creditCard?: AccountDerivedSummary;
}

/** 账户简要信息 — 用于账户明细列表展示 */
export interface AccountBrief {
  /** 类别键：nonRevolvingLoan / revolvingLoan1 / revolvingLoan2 / creditCard */
  category: string;
  /** 类别中文名 */
  categoryLabel: string;
  /** 管理机构/发卡机构 */
  org: string;
  /** 开立日期 */
  openDate: string;
  /** 借款金额/授信额度 */
  creditAmount: number;
  /** 余额/已用额度 */
  balance: number;
  /** 本月应还款 */
  monthlyPayment: number;
  /** 账户状态 */
  status: string;
  /** 是否结清/销户 */
  isClosed: boolean;
}

/** 完整的个人征信报告 */
export interface CreditReport {
  /** 模块一：报告头 */
  header: ReportHeader;
  /** 模块二：个人基本信息 */
  personalInfo: PersonalInfo;
  /** 模块三：信息概要 */
  summary: InfoSummary;
  /** 模块四：信贷交易信息明细 */
  creditDetail: CreditDetail;
  /** 从账户明细反算的汇总值 */
  accountDerived: AccountDerivedMap;
  /** 从账户明细提取的简要列表（用于账户明细 Tab） */
  accountBriefs: AccountBrief[];
  /** 模块五：非信贷交易信息明细 */
  nonCreditDetail: NonCreditDetail | null;
  /** 模块六：公共信息明细 */
  publicInfo: PublicInfo | null;
  /** 模块七：查询记录 */
  queryRecord: QueryRecord;
  /** 本人声明 */
  selfDeclaration: string | null;
  /** 异议标注 */
  disputeAnnotation: string | null;
  /** 异议信息提示 */
  disputeInfo: DisputeInfo;
  /** 相关还款责任信息明细 */
  repayResponsibilities: RepayResponsibilityAccount[];
  /** 授信协议信息 */
  creditAgreements: CreditAgreement[];
  /** 字段/模块溯源信息，用于人工核对和调试 */
  provenance: Record<string, FieldProvenance>;
}

/** 单个字段或模块的来源说明 */
export interface FieldProvenance {
  field: string;
  source: 'doc-table' | 'pdf-text' | 'derived' | 'manual' | 'unknown';
  label: string;
  pageNum?: number;
  logicalPage?: number;
  positionY?: number;
  precedingText?: string;
  confidence?: number;
}

// ============================================================
// 模块一：报告头
// ============================================================

export interface ReportHeader {
  reportNo: string;
  reportTime: string;
  name: string;
  certType: string;
  certNo: string;
  queryOrg: string;
  queryReason: string;
}

// ============================================================
// 模块二：个人基本信息
// ============================================================

export interface PersonalInfo {
  identity: IdentityInfo;
}

/** 2.1 身份信息 */
export interface IdentityInfo {
  gender: string | null;
  birthDate: string | null;
  maritalStatus: string | null;
  employmentStatus: string | null;
  education: string | null;
  degree: string | null;
  nationality: string | null;
  email: string | null;
  commAddress: string | null;
  registeredAddress: string | null;
}




// ============================================================
// 模块三：信息概要（仅保留逾期概要，其余已删除）
// ============================================================

export interface InfoSummary {
  /** 信贷交易违约信息概要（无逾期时为 null） */
  overdueSummary: OverdueSummary | null;
}

/** 信贷交易违约信息概要 */
export interface OverdueSummary {
  overdueAccountCount: number | null;
  overdueMonths: number | null;
  overdueMaxAmount: number | null;
  maxOverdueDuration: number | null;
}

// ============================================================
// 模块四：信贷交易信息明细
// ============================================================

export interface CreditDetail {
  /** 4.1 非循环贷账户 */
  nonRevolvingLoans: LoanAccount[];
  /** 4.2 循环贷账户一 */
  revolvingLoansType1: LoanAccount[];
  /** 4.3 循环贷账户二（授信额度型） */
  revolvingLoansType2: RevolvingLoanAccount[];
  /** 4.4 贷记卡账户 */
  creditCards: CreditCardAccount[];
  /** 4.5 准贷记卡账户 */
  quasiCreditCards: QuasiCreditCardAccount[];
}

/** 还款记录（单年） */
export interface RepaymentRecord {
  year: number;
  /** 12个月的还款状态码，索引0=1月 */
  months: (string | null)[];
}

/** 特殊交易记录 */
export interface SpecialTransaction {
  type: string;
  occurDate: string;
  changeMonths: number;
  amount: number;
  detail: string | null;
}

/** 大额专项分期信息 */
export interface LargeInstallment {
  installmentLimit: number | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  usedAmount: number | null;
}

/** 4.1 & 4.2 非循环贷/循环贷账户一 */
export interface LoanAccount {
  org: string;
  accountId: string;
  openDate: string;
  endDate: string | null;
  loanAmount: number;
  currency: string;
  businessType: string;
  guaranteeType: string;
  termCount: number | null;
  termFrequency: string | null;
  repayMethod: string | null;
  jointLoanFlag: string | null;
  status: string;
  fiveCategory: string | null;
  closeDate: string | null;
  balance: number | null;
  remainTerms: number | null;
  monthlyPayment: number | null;
  paymentDueDate: string | null;
  actualPayment: number | null;
  currentOverdueCount: number | null;
  currentOverdueAmount: number | null;
  overdue31_60: number | null;
  overdue61_90: number | null;
  overdue91_180: number | null;
  overdue180plus: number | null;
  specialTransactions: SpecialTransaction[];
  repaymentRecords: RepaymentRecord[];
  dataSource: string | null;
}

/** 4.3 循环贷账户二（授信额度型，借款金额换成授信额度） */
export interface RevolvingLoanAccount {
  org: string;
  accountId: string;
  openDate: string;
  endDate: string | null;
  creditLimit: number;
  currency: string;
  businessType: string;
  guaranteeType: string;
  termCount: number | null;
  termFrequency: string | null;
  repayMethod: string | null;
  jointLoanFlag: string | null;
  status: string;
  fiveCategory: string | null;
  closeDate: string | null;
  balance: number | null;
  remainTerms: number | null;
  monthlyPayment: number | null;
  paymentDueDate: string | null;
  actualPayment: number | null;
  currentOverdueCount: number | null;
  currentOverdueAmount: number | null;
  overdue31_60: number | null;
  overdue61_90: number | null;
  overdue91_180: number | null;
  overdue180plus: number | null;
  specialTransactions: SpecialTransaction[];
  repaymentRecords: RepaymentRecord[];
  dataSource: string | null;
}

/** 4.4 贷记卡账户 */
export interface CreditCardAccount {
  org: string;
  accountId: string;
  openDate: string;
  creditLimit: number;
  sharedCreditLimit: number | null;
  currency: string;
  businessType: string;
  guaranteeType: string;
  status: string;
  balance: number | null;
  usedAmount: number | null;
  unpostedLargeAmount: number | null;
  remainInstallments: number | null;
  avgUsed6m: number | null;
  maxUsed: number | null;
  billDate: string | null;
  monthlyPayment: number | null;
  actualPayment: number | null;
  lastPaymentDate: string | null;
  currentOverdueCount: number | null;
  currentOverdueAmount: number | null;
  largeInstallmentInfo: LargeInstallment | null;
  specialTransactions: SpecialTransaction[];
  repaymentRecords: RepaymentRecord[];
  dataSource: string | null;
}

/** 4.5 准贷记卡账户 */
export interface QuasiCreditCardAccount {
  org: string;
  accountId: string;
  openDate: string;
  creditLimit: number;
  sharedCreditLimit: number | null;
  currency: string;
  businessType: string;
  guaranteeType: string;
  status: string;
  balance: number | null;
  usedAmount: number | null;
  overdueAmount: number | null;
  avgUsed6m: number | null;
  maxUsed: number | null;
  billDate: string | null;
  currentOverdueCount: number | null;
  currentOverdueAmount: number | null;
  specialTransactions: SpecialTransaction[];
  repaymentRecords: RepaymentRecord[];
  dataSource: string | null;
}

// ============================================================
// 模块五：非信贷交易信息明细
// ============================================================

/** 非信贷交易（如后付费业务） */
export interface NonCreditDetail {
  records: NonCreditRecord[];
}

export interface NonCreditRecord {
  org: string;
  businessType: string;
  openDate: string;
  status: string;
  currentOverdueAmount: number | null;
  balance: number | null;
  dataSource: string | null;
}

// ============================================================
// 模块六：公共信息明细
// ============================================================

export interface PublicInfo {
  housingFund: HousingFundRecord[];
  pension: PensionRecord[];
}

/** 住房公积金记录 */
export interface HousingFundRecord {
  area: string;
  depositDate: string;
  initialAmount: number | null;
  monthlyDeposit: number | null;
  depositRatio: string | null;
  depositCompany: string | null;
  updateDate: string;
  dataSource: string | null;
}

/** 养老保险记录 */
export interface PensionRecord {
  area: string;
  participateDate: string;
  monthlyPayment: number | null;
  updateDate: string;
  dataSource: string | null;
}

// ============================================================
// 模块七：查询记录
// ============================================================

export interface QueryRecord {
  orgQueries: OrgQueryRecord[];
  selfQueries: SelfQueryRecord[];
}

/** 机构查询记录 */
export interface OrgQueryRecord {
  queryDate: string;
  queryOrg: string;
  queryReason: string;
}

/** 本人查询记录 */
export interface SelfQueryRecord {
  queryDate: string;
  queryOrg: string;
  queryReason: string;
}

// ============================================================
// 模块八：异议信息提示
// ============================================================

export interface DisputeInfo {
  /** 正在处理中的异议笔数 */
  disputeCount: number;
}

// ============================================================
// 模块九（附属）：相关还款责任信息明细
// ============================================================

/** 相关还款责任账户（担保/共同借款等） */
export interface RepayResponsibilityAccount {
  org: string;
  businessType: string;
  openDate: string;
  endDate: string | null;
  responsibilityType: string;
  responsibilityAmount: number;
  currency: string;
  contractNo: string | null;
  borrowerName: string | null;
  borrowerCertType: string | null;
  borrowerCertNo: string | null;
  balance: number | null;
  fiveCategory: string | null;
  repayStatus: string | null;
  dataSource: string | null;
}

// ============================================================
// 模块十（附属）：授信协议信息
// ============================================================

export interface CreditAgreement {
  org: string;
  agreementId: string;
  effectiveDate: string;
  expiryDate: string;
  creditPurpose: string;
  creditLimit: number;
  limitCap: number | null;
  limitCapId: string | null;
  usedAmount: number;
  currency: string;
}

// ============================================================
// 工厂函数：创建空报告
// ============================================================

/** 创建一份所有字段为空/默认值的征信报告 */
export function createEmptyCreditReport(): CreditReport {
  return {
    header: {
      reportNo: '', reportTime: '', name: '', certType: '',
      certNo: '', queryOrg: '', queryReason: '',
    },
    personalInfo: {
      identity: {
        gender: null, birthDate: null, maritalStatus: null,
        employmentStatus: null, education: null, degree: null,
        nationality: null, email: null, commAddress: null,
        registeredAddress: null,
      },
    },
    summary: {
      overdueSummary: null,
    },
    creditDetail: {
      nonRevolvingLoans: [], revolvingLoansType1: [],
      revolvingLoansType2: [], creditCards: [], quasiCreditCards: [],
    },
    accountDerived: {},
    accountBriefs: [],
    nonCreditDetail: null,
    publicInfo: null,
    queryRecord: { orgQueries: [], selfQueries: [] },
    selfDeclaration: null,
    disputeAnnotation: null,
    disputeInfo: { disputeCount: 0 },
    repayResponsibilities: [],
    creditAgreements: [],
    provenance: {},
  };
}
