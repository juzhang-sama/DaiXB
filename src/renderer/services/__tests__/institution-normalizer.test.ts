import assert from 'node:assert/strict';
import { createEmptyCreditReport, type CreditCardAccount, type RevolvingLoanAccount } from '../../types/credit-report';
import { normalizeCreditReportInstitutions, normalizeInstitutionName } from '../institution-normalizer';

function makeRevolvingLoan(partial: Partial<RevolvingLoanAccount>): RevolvingLoanAccount {
  return {
    org: partial.org ?? '招商银行',
    accountId: '',
    openDate: '2024.01.01',
    endDate: null,
    creditLimit: partial.creditLimit ?? 10000,
    currency: '人民币',
    businessType: '循环贷',
    guaranteeType: '信用',
    termCount: null,
    termFrequency: null,
    repayMethod: null,
    jointLoanFlag: null,
    status: '正常',
    fiveCategory: null,
    closeDate: null,
    balance: partial.balance ?? 1000,
    remainTerms: null,
    monthlyPayment: partial.monthlyPayment ?? 100,
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

function makeCard(partial: Partial<CreditCardAccount>): CreditCardAccount {
  return {
    org: partial.org ?? '广发银行',
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

const alias = normalizeInstitutionName('招行');
assert.equal(alias.matched, true);
assert.equal(alias.normalized, '招商银行股份有限公司');
assert.equal(alias.status, 'matched');
assert.equal(alias.applied, true);

const fuzzy = normalizeInstitutionName('广發银行股份有限公司');
assert.equal(fuzzy.matched, true);
assert.equal(fuzzy.normalized, '广发银行股份有限公司');
assert.equal(fuzzy.statusLabel, '机构库精确匹配');

const unknown = normalizeInstitutionName('某某测试机构');
assert.equal(unknown.matched, false);
assert.equal(unknown.status, 'unlisted');
assert.equal(unknown.statusLabel, '该机构未被收录');

const report = createEmptyCreditReport();
report.creditDetail.revolvingLoansType2 = [
  makeRevolvingLoan({ org: '重庆美团三快小额贷X44031234款有限公司' }),
];
report.creditDetail.creditCards = [
  makeCard({ org: '广發银行股份有限公司' }),
];

const normalized = normalizeCreditReportInstitutions(report);
assert.equal(normalized.report.creditDetail.revolvingLoansType2[0].org, '重庆美团三快小额贷款有限公司');
assert.equal(normalized.report.creditDetail.creditCards[0].org, '广发银行股份有限公司');
assert.equal(normalized.corrections.length >= 2, true);
assert.equal(normalized.corrections.every((item) => item.status === 'matched'), true);

const reportWithUnknown = createEmptyCreditReport();
reportWithUnknown.creditDetail.creditCards = [
  makeCard({ org: '某某测试机构' }),
];
const unknownNormalized = normalizeCreditReportInstitutions(reportWithUnknown);
assert.equal(unknownNormalized.report.creditDetail.creditCards[0].org, '某某测试机构');
assert.equal(unknownNormalized.corrections[0].status, 'unlisted');
