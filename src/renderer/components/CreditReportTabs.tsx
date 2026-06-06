import React, { useCallback, useMemo, useState } from 'react';
import { Tabs, Spin, message } from 'antd';
import type { CreditReport } from '../types/credit-report';
import PersonalInfoTab from './tabs/PersonalInfoTab';
import CreditDetailTab from './tabs/CreditDetailTab';
import QueryRecordTab from './tabs/QueryRecordTab';
import CreditAssessmentTab from './tabs/CreditAssessmentTab';
import ProvenanceTab from './tabs/ProvenanceTab';
import OcrQualityTab from './tabs/OcrQualityTab';
import DebtAnalysisReportTab from './tabs/DebtAnalysisReportTab';
import type { OcrQualityReport } from '../parser/ocr-quality';
import type { OcrDiagnosticsReport, OcrReviewState } from '../types/ocr-diagnostics';
import { validateCreditReportData } from '../services/credit-report-validation';

interface CreditReportTabsProps {
  report: CreditReport;
  loading: boolean;
  quality?: OcrQualityReport;
  diagnostics?: OcrDiagnosticsReport;
  reviewState?: OcrReviewState;
  onChange: (report: CreditReport) => void;
  onReviewIssues?: (issueIds: string[]) => void;
  onClearReview?: () => void;
}

/**
 * 征信报告主 Tab 组件
 * 按一级章节组织：个人基本信息、信贷交易信息明细、查询记录
 */
const CreditReportTabs: React.FC<CreditReportTabsProps> = ({
  report,
  loading,
  quality,
  diagnostics,
  reviewState,
  onChange,
  onReviewIssues,
  onClearReview,
}) => {
  const [activeKey, setActiveKey] = useState('debtAnalysis');
  const validation = useMemo(() => validateCreditReportData(report), [report]);
  const diagnosticsForQuality = useMemo(
    () => diagnostics ? { ...diagnostics, validation } : diagnostics,
    [diagnostics, validation],
  );
  const reviewedIds = useMemo(() => new Set(reviewState?.reviewedIssueIds ?? []), [reviewState]);
  const pendingValidationCount = diagnosticsForQuality?.validation.issues.filter((issue) => (
    (issue.severity === 'critical' || issue.severity === 'warning') && !reviewedIds.has(issue.id)
  )).length ?? 0;
  const institutionAttentionCount = diagnosticsForQuality?.institutionCorrections?.length ?? 0;
  const reviewCount = (quality?.issues.length ?? 0) + pendingValidationCount + institutionAttentionCount;

  const handleOpenIssue = useCallback((field: string) => {
    const nextKey = getIssueTabKey(field);
    setActiveKey(nextKey);
    message.info(`已切换到${TAB_LABEL[nextKey]}，可点击对应字段进行修改。`);
  }, []);

  const items = [
    {
      key: 'quality',
      label: `解析质量${reviewCount ? ` (${reviewCount})` : ''}`,
      children: (
        <OcrQualityTab
          quality={quality}
          diagnostics={diagnosticsForQuality}
          reviewState={reviewState}
          onReviewIssues={onReviewIssues}
          onClearReview={onClearReview}
          onOpenIssue={handleOpenIssue}
        />
      ),
    },
    { key: 'debtAnalysis', label: '数据分析报告', children: <DebtAnalysisReportTab report={report} diagnostics={diagnostics} reviewState={reviewState} /> },
    { key: 'personal', label: '个人基本信息', children: <PersonalInfoTab report={report} onChange={onChange} /> },
    { key: 'credit', label: '信贷交易信息明细', children: <CreditDetailTab report={report} onChange={onChange} /> },
    { key: 'query', label: '查询记录', children: <QueryRecordTab report={report} onChange={onChange} /> },
    { key: 'assessment', label: '征信评估', children: <CreditAssessmentTab report={report} /> },
    { key: 'provenance', label: '字段溯源', children: <ProvenanceTab report={report} /> },
  ];

  return (
    <Spin spinning={loading} description="正在解析征信报告...">
      <div className="bg-white shadow rounded-lg p-6 min-h-[500px]">
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={items}
          type="card"
          className="custom-tabs"
        />
      </div>
    </Spin>
  );
};

const TAB_LABEL: Record<string, string> = {
  personal: '个人基本信息',
  credit: '信贷交易信息明细',
  query: '查询记录',
  quality: '解析质量',
  debtAnalysis: '数据分析报告',
  assessment: '征信评估',
  provenance: '字段溯源',
};

function getIssueTabKey(field: string): string {
  if (field.startsWith('header.') || field.startsWith('personalInfo.')) return 'personal';
  if (field.startsWith('queryRecord')) return 'query';
  if (
    field.startsWith('nonRevolvingLoans')
    || field.startsWith('revolvingLoansType1')
    || field.startsWith('revolvingLoansType2')
    || field.startsWith('creditCards')
    || field.startsWith('accountDerived.')
  ) {
    return 'credit';
  }
  return 'quality';
}

export default CreditReportTabs;
