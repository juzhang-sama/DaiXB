import type { CreditReport } from '../types/credit-report';

export interface OcrExpectedField {
  path: string;
  expected: string | number | null;
}

export interface OcrFieldEvaluationRow {
  path: string;
  expected: string | number | null;
  actual: string | number | null;
  passed: boolean;
}

export interface OcrEvaluationReport {
  total: number;
  passed: number;
  failed: number;
  accuracy: number;
  rows: OcrFieldEvaluationRow[];
}

export function evaluateCreditReportFields(
  report: CreditReport,
  expectedFields: OcrExpectedField[],
): OcrEvaluationReport {
  const rows = expectedFields.map((field) => {
    const actual = readPath(report, field.path);
    const passed = normalizeValue(actual) === normalizeValue(field.expected);
    return {
      path: field.path,
      expected: field.expected,
      actual,
      passed,
    };
  });

  const passed = rows.filter((row) => row.passed).length;
  return {
    total: rows.length,
    passed,
    failed: rows.length - passed,
    accuracy: rows.length > 0 ? round(passed / rows.length) : 1,
    rows,
  };
}

function readPath(source: unknown, path: string): string | number | null {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: any = source;
  for (const part of parts) {
    if (current === null || current === undefined) return null;
    current = current[part];
  }
  if (typeof current === 'string' || typeof current === 'number') return current;
  if (current === null || current === undefined) return null;
  return String(current);
}

function normalizeValue(value: string | number | null): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(Math.round(value * 100) / 100);
  return value.replace(/\s+/g, '').replace(/,/g, '').trim();
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
