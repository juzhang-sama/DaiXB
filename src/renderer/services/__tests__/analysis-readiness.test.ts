import assert from 'node:assert/strict';
import { buildAnalysisReadiness } from '../analysis-readiness';
import type { CreditReportValidationIssue, CreditReportValidationReport } from '../../types/ocr-diagnostics';

function makeIssue(partial: Partial<CreditReportValidationIssue>): CreditReportValidationIssue {
  return {
    id: partial.id ?? 'issue-1',
    severity: partial.severity ?? 'warning',
    category: partial.category ?? '金额字段',
    field: partial.field ?? 'creditCards[0].usedAmount',
    label: partial.label ?? '已用额度',
    message: partial.message ?? '字段需复核',
    suggestion: partial.suggestion ?? '请核对原始报告。',
  };
}

function makeValidation(partial: Partial<CreditReportValidationReport>): CreditReportValidationReport {
  return {
    score: partial.score ?? 1,
    requiresReview: partial.requiresReview ?? false,
    summary: partial.summary ?? { critical: 0, warning: 0, info: 0 },
    issues: partial.issues ?? [],
  };
}

const ready = buildAnalysisReadiness(makeValidation({}));
assert.equal(ready.blocked, false);
assert.equal(ready.alertType, 'info');
assert.equal(ready.displayIssues.length, 0);

const critical = buildAnalysisReadiness(makeValidation({
  requiresReview: true,
  summary: { critical: 1, warning: 0, info: 0 },
  issues: [makeIssue({ severity: 'critical', message: '已用额度大于授信额度' })],
}));
assert.equal(critical.blocked, true);
assert.equal(critical.alertType, 'error');
assert.equal(critical.criticalIssues.length, 1);
assert.equal(critical.reason.includes('高风险字段冲突'), true);

const reviewedCritical = buildAnalysisReadiness(makeValidation({
  requiresReview: true,
  summary: { critical: 1, warning: 0, info: 0 },
  issues: [makeIssue({ id: 'critical-1', severity: 'critical', message: '已用额度大于授信额度' })],
}), { reviewedIssueIds: ['critical-1'] });
assert.equal(reviewedCritical.blocked, false);
assert.equal(reviewedCritical.reviewedIssueCount, 1);
assert.equal(reviewedCritical.unreviewedIssueCount, 0);

const warnings = Array.from({ length: 4 }, (_, index) => makeIssue({
  id: `warning-${index}`,
  severity: 'warning',
}));
const warningGate = buildAnalysisReadiness(makeValidation({
  requiresReview: true,
  summary: { critical: 0, warning: warnings.length, info: 0 },
  issues: warnings,
}));
assert.equal(warningGate.blocked, true);
assert.equal(warningGate.alertType, 'warning');
assert.equal(warningGate.warningIssues.length, 4);
assert.equal(warningGate.reason.includes('字段需集中复核'), true);

const partlyReviewedWarningGate = buildAnalysisReadiness(makeValidation({
  requiresReview: true,
  summary: { critical: 0, warning: warnings.length, info: 0 },
  issues: warnings,
}), { reviewedIssueIds: ['warning-0', 'warning-1'] });
assert.equal(partlyReviewedWarningGate.blocked, false);
assert.equal(partlyReviewedWarningGate.reviewedIssueCount, 2);
assert.equal(partlyReviewedWarningGate.unreviewedIssueCount, 2);
