import assert from 'node:assert/strict';
import { createEmptyCreditReport, type LoanAccount } from '../../types/credit-report';
import { buildCreditReportWorkbookSheets } from '../excel-export';
import { validateCreditReportData } from '../credit-report-validation';

function makeLoan(partial: Partial<LoanAccount>): LoanAccount {
  return {
    org: '测试银行',
    accountId: partial.accountId ?? 'L1',
    openDate: '2024.01.01',
    endDate: null,
    loanAmount: partial.loanAmount ?? partial.balance ?? 0,
    currency: '人民币',
    businessType: partial.businessType ?? '其他个人消费贷款',
    guaranteeType: '信用',
    termCount: null,
    termFrequency: null,
    repayMethod: null,
    jointLoanFlag: null,
    status: partial.status ?? '正常',
    fiveCategory: null,
    closeDate: null,
    balance: partial.balance ?? 0,
    remainTerms: null,
    monthlyPayment: partial.monthlyPayment ?? 0,
    paymentDueDate: null,
    actualPayment: null,
    currentOverdueCount: null,
    currentOverdueAmount: null,
    overdue31_60: null,
    overdue61_90: null,
    overdue91_180: null,
    overdue180plus: null,
    specialTransactions: [],
    repaymentRecords: [],
    dataSource: null,
    ...partial,
  };
}

const report = createEmptyCreditReport();
report.header.name = '测试客户';
report.header.reportNo = 'R1';
report.header.reportTime = '2026.04.28';
report.creditDetail.nonRevolvingLoans = [
  makeLoan({ businessType: '其他个人消费贷款', balance: 100000, monthlyPayment: 3000 }),
];
report.accountDerived.nonRevolvingLoan = {
  orgCount: 1,
  accountCount: 2,
  totalCredit: 100000,
  balance: 100000,
  monthlyPayment: 3000,
};

const issueId = '账户数量:accountDerived.nonRevolvingLoan.accountCount:1';
const sheets = buildCreditReportWorkbookSheets(report, {
  reviewedIssueIds: [issueId],
  reviewedAt: '2026-06-06T12:00:00.000Z',
}, {
  images: [],
  candidates: [],
  validation: validateCreditReportData(report),
  institutionCorrections: [
    {
      field: 'creditDetail.nonRevolvingLoans[0].org',
      original: '测詴银行',
      normalized: '测试银行',
      confidence: 0.9,
      matched: true,
      applied: true,
      status: 'matched',
      statusLabel: '经机构库匹配',
      matchType: 'fuzzy',
      candidates: ['测试银行'],
    },
  ],
});

const reviewSheet = sheets.find((sheet) => sheet.name === 'OCR复核记录');
assert.ok(reviewSheet);
assert.deepEqual(reviewSheet.rows[0], ['生成时间', reviewSheet.rows[0][1]]);
assert.deepEqual(reviewSheet.rows[1], ['最近复核时间', '2026-06-06T12:00:00.000Z']);
assert.equal(reviewSheet.rows.some((row) => row.includes('已人工复核')), true);
assert.equal(reviewSheet.rows.some((row) => row.includes('非循环贷账户数量不一致：章节识别 2 笔，明细解析 1 笔')), true);
assert.equal(reviewSheet.rows.some((row) => row.includes('机构库匹配记录')), true);
assert.equal(reviewSheet.rows.some((row) => row.includes('经机构库匹配')), true);
assert.equal(reviewSheet.rows.some((row) => row.includes('已采用标准机构名')), true);
