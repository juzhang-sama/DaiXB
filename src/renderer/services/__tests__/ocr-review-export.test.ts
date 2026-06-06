import assert from 'node:assert/strict';
import { createEmptyCreditReport, type CreditCardAccount } from '../../types/credit-report';
import { buildOcrReviewExportSummary } from '../ocr-review-export';

function makeCard(partial: Partial<CreditCardAccount>): CreditCardAccount {
  return {
    org: partial.org ?? '测试银行',
    accountId: '',
    openDate: '2024.01.01',
    creditLimit: partial.creditLimit ?? 10000,
    sharedCreditLimit: null,
    currency: '人民币',
    businessType: '贷记卡',
    guaranteeType: '',
    status: partial.status ?? '正常',
    balance: null,
    usedAmount: partial.usedAmount ?? 0,
    unpostedLargeAmount: null,
    remainInstallments: null,
    avgUsed6m: null,
    maxUsed: null,
    billDate: null,
    monthlyPayment: null,
    actualPayment: null,
    lastPaymentDate: null,
    currentOverdueCount: null,
    currentOverdueAmount: null,
    largeInstallmentInfo: null,
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
report.creditDetail.creditCards = [
  makeCard({ creditLimit: 10000, usedAmount: 20000 }),
];

const initialSummary = buildOcrReviewExportSummary(report);
assert.equal(initialSummary.totalReviewable >= 1, true);
assert.equal(initialSummary.pendingCount, initialSummary.totalReviewable);
assert.equal(initialSummary.reviewedCount, 0);
assert.equal(initialSummary.rows.some((row) => row.message.includes('已用额度大于授信额度')), true);

const reviewedRow = initialSummary.rows.find((row) => row.message.includes('已用额度大于授信额度'));
assert.ok(reviewedRow);

const reviewedSummary = buildOcrReviewExportSummary(report, {
  reviewedIssueIds: [reviewedRow.id],
  reviewedAt: '2026-06-06T12:00:00.000Z',
});
assert.equal(reviewedSummary.reviewedAt, '2026-06-06T12:00:00.000Z');
assert.equal(reviewedSummary.reviewedCount, 1);
assert.equal(reviewedSummary.rows.find((row) => row.id === reviewedRow.id)?.status, '已人工复核');

const institutionSummary = buildOcrReviewExportSummary(report, undefined, [
  {
    field: 'creditDetail.creditCards[0].org',
    sourceLabel: '贷记卡账户第1笔机构',
    pageNum: 2,
    logicalPage: 5,
    precedingText: '账户1',
    original: '广發银行股份有限公司',
    normalized: '广发银行股份有限公司',
    confidence: 0.91,
    matched: true,
    applied: true,
    status: 'matched',
    statusLabel: '经机构库模糊匹配',
    matchType: 'fuzzy',
    candidates: ['广发银行股份有限公司'],
  },
  {
    field: 'creditDetail.creditCards[1].org',
    original: '某某测试机构',
    normalized: '某某测试机构',
    confidence: 0,
    matched: false,
    applied: false,
    status: 'unlisted',
    statusLabel: '该机构未被收录',
    matchType: 'none',
    candidates: [],
  },
]);
assert.equal(institutionSummary.institutionRows.length, 2);
assert.equal(institutionSummary.institutionRows[0].source, '贷记卡账户第1笔机构 / 物理页3 / 征信页5 / 账户1');
assert.equal(institutionSummary.institutionRows[0].status, '经机构库模糊匹配');
assert.equal(institutionSummary.institutionRows[0].applied, '已采用标准机构名');
assert.equal(institutionSummary.institutionRows[1].status, '该机构未被收录');
assert.equal(institutionSummary.institutionRows[1].applied, '原文保留');
