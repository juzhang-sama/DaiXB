import assert from 'node:assert/strict';
import { createEmptyCreditReport, type CreditCardAccount } from '../../types/credit-report';
import { evaluateCreditReportFields } from '../ocr-evaluation';

function makeCard(partial: Partial<CreditCardAccount>): CreditCardAccount {
  return {
    org: partial.org ?? '广发银行股份有限公司',
    accountId: '',
    openDate: '2024.01.01',
    creditLimit: partial.creditLimit ?? 10000,
    sharedCreditLimit: null,
    currency: '人民币',
    businessType: '贷记卡',
    guaranteeType: '',
    status: '正常',
    balance: null,
    usedAmount: partial.usedAmount ?? 1000,
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
report.header.name = '张三';
report.header.reportNo = 'R1';
report.creditDetail.creditCards = [makeCard({ creditLimit: 50000, usedAmount: 12000 })];

const evaluation = evaluateCreditReportFields(report, [
  { path: 'header.name', expected: '张三' },
  { path: 'header.reportNo', expected: 'R1' },
  { path: 'creditDetail.creditCards[0].org', expected: '广发银行股份有限公司' },
  { path: 'creditDetail.creditCards[0].creditLimit', expected: 50000 },
  { path: 'creditDetail.creditCards[0].usedAmount', expected: 13000 },
]);

assert.equal(evaluation.total, 5);
assert.equal(evaluation.passed, 4);
assert.equal(evaluation.failed, 1);
assert.equal(evaluation.accuracy, 0.8);
assert.equal(evaluation.rows.find((row) => row.path.endsWith('usedAmount'))?.passed, false);
