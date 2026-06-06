import { validateCreditReportData } from './credit-report-validation';
import type { CreditReport } from '../types/credit-report';
import type {
  CreditReportValidationIssue,
  InstitutionCorrectionDiagnostic,
  OcrReviewState,
} from '../types/ocr-diagnostics';

export interface OcrReviewExportRow {
  id: string;
  severity: string;
  category: string;
  field: string;
  message: string;
  suggestion: string;
  status: '已人工复核' | '未复核';
}

export interface OcrReviewExportSummary {
  generatedAt: string;
  reviewedAt: string;
  totalReviewable: number;
  reviewedCount: number;
  pendingCount: number;
  rows: OcrReviewExportRow[];
  institutionRows: InstitutionMatchExportRow[];
}

export interface InstitutionMatchExportRow {
  field: string;
  original: string;
  normalized: string;
  status: string;
  confidence: string;
  applied: string;
  candidates: string;
}

export function buildOcrReviewExportSummary(
  report: CreditReport,
  reviewState?: OcrReviewState,
  institutionCorrections: InstitutionCorrectionDiagnostic[] = [],
): OcrReviewExportSummary {
  const validation = validateCreditReportData(report);
  const reviewedIds = new Set(reviewState?.reviewedIssueIds ?? []);
  const reviewableIssues = validation.issues.filter(isReviewableIssue);
  const rows: OcrReviewExportRow[] = reviewableIssues.map((issue) => ({
    id: issue.id,
    severity: formatSeverity(issue.severity),
    category: issue.category,
    field: issue.field,
    message: issue.message,
    suggestion: issue.suggestion,
    status: buildReviewStatus(reviewedIds.has(issue.id)),
  }));

  return {
    generatedAt: new Date().toISOString(),
    reviewedAt: reviewState?.reviewedAt ?? '',
    totalReviewable: rows.length,
    reviewedCount: rows.filter((row) => row.status === '已人工复核').length,
    pendingCount: rows.filter((row) => row.status === '未复核').length,
    rows,
    institutionRows: institutionCorrections.map(buildInstitutionRow),
  };
}

function isReviewableIssue(issue: CreditReportValidationIssue): boolean {
  return issue.severity === 'critical' || issue.severity === 'warning';
}

function formatSeverity(severity: CreditReportValidationIssue['severity']): string {
  if (severity === 'critical') return '高风险';
  if (severity === 'warning') return '需复核';
  return '提示';
}

function buildReviewStatus(reviewed: boolean): OcrReviewExportRow['status'] {
  return reviewed ? '已人工复核' : '未复核';
}

function buildInstitutionRow(item: InstitutionCorrectionDiagnostic): InstitutionMatchExportRow {
  return {
    field: item.field,
    original: item.original,
    normalized: item.normalized,
    status: item.statusLabel || formatInstitutionStatus(item),
    confidence: item.confidence > 0 ? `${Math.round(item.confidence * 100)}%` : '',
    applied: item.applied ? '已采用标准机构名' : '原文保留',
    candidates: item.candidates.join('、'),
  };
}

function formatInstitutionStatus(item: InstitutionCorrectionDiagnostic): string {
  if (item.status === 'matched') return item.matchType === 'fuzzy' ? '经机构库模糊匹配' : '经机构库匹配';
  if (item.status === 'review') return '疑似机构，请复核';
  return '该机构未被收录';
}
