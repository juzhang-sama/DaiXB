import type {
  CreditReportValidationIssue,
  CreditReportValidationReport,
  OcrReviewState,
} from '../types/ocr-diagnostics';

export interface AnalysisReadiness {
  blocked: boolean;
  alertType: 'error' | 'warning' | 'info';
  reason: string;
  actionHint: string;
  criticalIssues: CreditReportValidationIssue[];
  warningIssues: CreditReportValidationIssue[];
  displayIssues: CreditReportValidationIssue[];
  hiddenIssueCount: number;
  reviewedIssueCount: number;
  unreviewedIssueCount: number;
}

export function buildAnalysisReadiness(
  validation?: CreditReportValidationReport,
  reviewState?: OcrReviewState,
): AnalysisReadiness {
  const reviewedIds = new Set(reviewState?.reviewedIssueIds ?? []);
  const reviewableIssues = validation?.issues.filter((issue) => isReviewableIssue(issue)) ?? [];
  const reviewedIssueCount = reviewableIssues.filter((issue) => reviewedIds.has(issue.id)).length;
  const unreviewedIssues = reviewableIssues.filter((issue) => !reviewedIds.has(issue.id));
  const criticalIssues = unreviewedIssues.filter((issue) => issue.severity === 'critical');
  const warningIssues = unreviewedIssues.filter((issue) => issue.severity === 'warning');
  const blocked = criticalIssues.length > 0 || warningIssues.length >= 3;
  const alertType = criticalIssues.length > 0 ? 'error' : blocked ? 'warning' : 'info';
  const reason = buildReason(blocked, criticalIssues.length, warningIssues.length);
  const displayIssues = unreviewedIssues.slice(0, 5);

  return {
    blocked,
    alertType,
    reason,
    actionHint: blocked ? '存在需复核的 OCR 关键字段，请先修正或核对后再继续。' : '',
    criticalIssues,
    warningIssues,
    displayIssues,
    hiddenIssueCount: Math.max(0, unreviewedIssues.length - displayIssues.length),
    reviewedIssueCount,
    unreviewedIssueCount: unreviewedIssues.length,
  };
}

function isReviewableIssue(issue: CreditReportValidationIssue): boolean {
  return issue.severity === 'critical' || issue.severity === 'warning';
}

function buildReason(blocked: boolean, criticalCount: number, warningCount: number): string {
  if (!blocked) return '';
  if (criticalCount > 0) return `发现 ${criticalCount} 项高风险字段冲突`;
  return `发现 ${warningCount} 项字段需集中复核`;
}
