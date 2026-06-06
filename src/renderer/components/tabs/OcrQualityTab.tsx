import React from 'react';
import { Alert, Button, Descriptions, Progress, Space, Table, Tag } from 'antd';
import type { OcrQualityReport } from '../../parser/ocr-quality';
import type { InstitutionCorrectionDiagnostic, OcrDiagnosticsReport, OcrReviewState } from '../../types/ocr-diagnostics';

interface OcrQualityTabProps {
  quality?: OcrQualityReport;
  diagnostics?: OcrDiagnosticsReport;
  reviewState?: OcrReviewState;
  onReviewIssues?: (issueIds: string[]) => void;
  onClearReview?: () => void;
  onOpenIssue?: (field: string) => void;
}

function formatPercent(score: number): number {
  return Math.round(score * 100);
}

function getScoreStatus(score: number): 'success' | 'normal' | 'exception' {
  if (score >= 0.9) return 'success';
  if (score >= 0.75) return 'normal';
  return 'exception';
}

function getAlertType(quality: OcrQualityReport): 'success' | 'warning' | 'error' {
  if (quality.score < 0.75) return 'error';
  if (quality.issues.length > 0) return 'warning';
  return 'success';
}

function getAlertMessage(quality: OcrQualityReport): string {
  if (quality.score < 0.75) return 'OCR 结构质量偏低，建议复核后再用于分析';
  if (quality.scope.type === 'fragment' && quality.issues.length === 0) return '已按片段模式完成解析';
  if (quality.issues.length > 0) return `OCR 结构可用，存在 ${quality.issues.length} 项需复核提示`;
  return 'OCR 结构质量良好';
}

function getProfileLabel(quality: OcrQualityReport): string {
  if (quality.profile === 'pboc-personal-detailed') return '本人详版';
  if (quality.profile === 'pboc-personal-fragment') return '本人详版片段';
  return '未知';
}

function getProfileColor(quality: OcrQualityReport): string {
  if (quality.profile === 'pboc-personal-detailed') return 'green';
  if (quality.profile === 'pboc-personal-fragment') return 'blue';
  return 'gold';
}

function getScopeColor(type: OcrQualityReport['scope']['type']): string {
  if (type === 'complete') return 'green';
  if (type === 'fragment') return 'blue';
  return 'gold';
}

const SOURCE_LABEL: Record<string, string> = {
  anchor: '章节锚点',
  table: '表格字段',
  mixed: '锚点+表格',
};

const INSTITUTION_STATUS_COLOR: Record<InstitutionCorrectionDiagnostic['status'], string> = {
  matched: 'green',
  review: 'orange',
  unlisted: 'red',
};

function getInstitutionStatusLabel(item: InstitutionCorrectionDiagnostic): string {
  if (item.statusLabel) return item.statusLabel;
  if (item.status === 'matched') return item.matchType === 'fuzzy' ? '经机构库模糊匹配' : '经机构库匹配';
  if (item.status === 'review') return '疑似机构，请复核';
  return '该机构未被收录';
}

function formatInstitutionSource(item: InstitutionCorrectionDiagnostic): string {
  const parts: string[] = [];
  if (item.sourceLabel) parts.push(item.sourceLabel);
  if (item.pageNum !== undefined) parts.push(`物理页 ${item.pageNum + 1}`);
  if (item.logicalPage !== undefined) parts.push(`征信页 ${item.logicalPage}`);
  if (item.precedingText) parts.push(item.precedingText);
  return parts.join(' / ') || '-';
}

const OcrQualityTab: React.FC<OcrQualityTabProps> = ({
  quality,
  diagnostics,
  reviewState,
  onReviewIssues,
  onClearReview,
  onOpenIssue,
}) => {
  const validation = diagnostics?.validation;

  if (!quality && !diagnostics) {
    return (
      <Alert
        type="info"
        showIcon
        title="暂无 OCR 质量报告"
        description="电子版文本直提或尚未运行 OCR 时，不会生成 OCR 结构质量报告。"
      />
    );
  }

  if (!quality && diagnostics) {
    return (
      <div className="space-y-4">
        <Alert
          type={validation?.requiresReview ? 'warning' : 'success'}
          showIcon
          title={validation?.requiresReview ? '存在需复核字段' : '字段一致性校验通过'}
          description="电子版文本直提不会生成 OCR 结构质量报告，但仍会进行字段与金额一致性校验。"
        />
        {renderDiagnostics(diagnostics, reviewState, onReviewIssues, onClearReview, onOpenIssue)}
      </div>
    );
  }

  if (!quality) return null;

  const issueRows = quality.issues.map((issue, index) => ({
    key: index,
    level: issue.includes('缺少') || issue.includes('不可用') ? '高' : '中',
    issue,
  }));

  const queryRows = [
    {
      key: 'org',
      type: '机构查询',
      numbered: quality.queryNumbering.orgNumbered,
      gaps: quality.queryNumbering.gaps.filter((gap) => gap.includes('机构查询')).join('；') || '-',
    },
    {
      key: 'self',
      type: '本人查询',
      numbered: quality.queryNumbering.selfNumbered,
      gaps: quality.queryNumbering.gaps.filter((gap) => gap.includes('本人查询')).join('；') || '-',
    },
    {
      key: 'unknown',
      type: '未分类查询',
      numbered: quality.queryNumbering.unknownNumbered,
      gaps: quality.queryNumbering.gaps.filter((gap) => gap.includes('未分类查询')).join('；') || '-',
    },
  ];
  const moduleRows = quality.scope.recognizedModules.map((item) => ({
    key: item.key,
    label: item.label,
    count: item.count,
    source: SOURCE_LABEL[item.source] ?? item.source,
  }));

  return (
    <div className="space-y-4">
      <Alert
        type={getAlertType(quality)}
        showIcon
        title={getAlertMessage(quality)}
        description={quality.issues.length > 0 ? quality.issues.join('；') : undefined}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        <div className="border border-gray-100 rounded p-4 flex flex-col items-center justify-center">
          <Progress
            type="circle"
            percent={formatPercent(quality.score)}
            status={getScoreStatus(quality.score)}
            size={132}
          />
          <div className="mt-3 text-sm text-gray-500">结构质量分</div>
        </div>

        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="报告形态">
            <Tag color={getProfileColor(quality)}>{getProfileLabel(quality)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="解析范围">
            <Tag color={getScopeColor(quality.scope.type)}>{quality.scope.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="物理页数">{quality.pages}</Descriptions.Item>
          <Descriptions.Item label="范围判断">{quality.scope.reason}</Descriptions.Item>
          <Descriptions.Item label="关键锚点">
            {quality.anchors.found}/{quality.anchors.required}
          </Descriptions.Item>
          <Descriptions.Item label="逻辑页脚">
            {quality.footers.found}/{quality.footers.totalLogicalPages ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="结构表格">{quality.tables.count}</Descriptions.Item>
          <Descriptions.Item label="表格行数">{quality.tables.markdownRows}</Descriptions.Item>
          <Descriptions.Item label="账户锚点">{quality.accountAnchors.count}</Descriptions.Item>
          <Descriptions.Item label="月供字段">{quality.fieldCoverage.monthlyPaymentLabels}</Descriptions.Item>
          <Descriptions.Item label="实还字段">{quality.fieldCoverage.actualPaymentLabels}</Descriptions.Item>
          <Descriptions.Item label="应还/账单日字段">{quality.fieldCoverage.dueDateLabels}</Descriptions.Item>
        </Descriptions>
      </div>

      <Table
        title={() => '已识别模块'}
        dataSource={moduleRows}
        size="small"
        pagination={false}
        locale={{ emptyText: '暂无可识别模块' }}
        columns={[
          { title: '模块', dataIndex: 'label', key: 'label', width: 180 },
          { title: '识别来源', dataIndex: 'source', key: 'source', width: 140 },
          { title: '命中次数', dataIndex: 'count', key: 'count', width: 100 },
        ]}
      />

      <Table
        title={() => '质量提示'}
        dataSource={issueRows}
        size="small"
        pagination={false}
        locale={{ emptyText: '暂无质量提示' }}
        columns={[
          {
            title: '级别',
            dataIndex: 'level',
            key: 'level',
            width: 90,
            render: (level: string) => <Tag color={level === '高' ? 'red' : 'gold'}>{level}</Tag>,
          },
          { title: '说明', dataIndex: 'issue', key: 'issue' },
        ]}
      />

      <Table
        title={() => '查询记录编号连续性'}
        dataSource={queryRows}
        size="small"
        pagination={false}
        columns={[
          { title: '类型', dataIndex: 'type', key: 'type', width: 140 },
          { title: '已识别编号数', dataIndex: 'numbered', key: 'numbered', width: 130 },
          { title: '断点', dataIndex: 'gaps', key: 'gaps' },
        ]}
      />

      {diagnostics && renderDiagnostics(diagnostics, reviewState, onReviewIssues, onClearReview, onOpenIssue)}
    </div>
  );
};

function renderDiagnostics(
  diagnostics: OcrDiagnosticsReport,
  reviewState?: OcrReviewState,
  onReviewIssues?: (issueIds: string[]) => void,
  onClearReview?: () => void,
  onOpenIssue?: (field: string) => void,
): React.ReactNode {
  const reviewedIds = new Set(reviewState?.reviewedIssueIds ?? []);
  const imageRows = diagnostics.images.map((item, index) => ({
    key: index,
    ...item,
    size: `${item.width}×${item.height}`,
    issueText: item.issues.join('；') || '-',
  }));

  const candidateRows = diagnostics.candidates.map((item, index) => ({
    key: index,
    ...item,
    issueText: item.issues.join('；') || '-',
  }));
  const institutionRows = (diagnostics.institutionCorrections ?? []).map((item, index) => ({
    key: index,
    ...item,
    statusLabel: getInstitutionStatusLabel(item),
    sourceText: formatInstitutionSource(item),
    candidatesText: item.candidates.join('、') || '-',
  }));

  const validationRows = diagnostics.validation.issues.map((item) => ({
    key: item.id,
    ...item,
    reviewed: reviewedIds.has(item.id),
  }));
  const reviewableRows = validationRows.filter((item) => item.severity === 'critical' || item.severity === 'warning');
  const reviewedCount = reviewableRows.filter((item) => item.reviewed).length;
  const unreviewedIds = reviewableRows.filter((item) => !item.reviewed).map((item) => item.id);

  return (
    <>
      <Descriptions bordered size="small" column={4}>
        <Descriptions.Item label="字段校验分">
          <Tag color={diagnostics.validation.score >= 0.9 ? 'green' : diagnostics.validation.score >= 0.75 ? 'gold' : 'red'}>
            {formatPercent(diagnostics.validation.score)}%
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="高风险">{diagnostics.validation.summary.critical}</Descriptions.Item>
        <Descriptions.Item label="需复核">{diagnostics.validation.summary.warning}</Descriptions.Item>
        <Descriptions.Item label="提示">{diagnostics.validation.summary.info}</Descriptions.Item>
        <Descriptions.Item label="已人工复核">{reviewedCount}</Descriptions.Item>
      </Descriptions>

      <Table
        title={() => '图片输入质量'}
        dataSource={imageRows}
        size="small"
        pagination={false}
        locale={{ emptyText: '非图片 OCR 或暂无图片质量诊断' }}
        columns={[
          { title: '文件', dataIndex: 'fileName', key: 'fileName', width: 220 },
          { title: '尺寸', dataIndex: 'size', key: 'size', width: 130 },
          { title: '清晰度', dataIndex: 'sharpness', key: 'sharpness', width: 90 },
          {
            title: '评分',
            dataIndex: 'score',
            key: 'score',
            width: 90,
            render: (score: number) => <Tag color={score >= 0.86 ? 'green' : score >= 0.7 ? 'gold' : 'red'}>{formatPercent(score)}%</Tag>,
          },
          { title: '提示', dataIndex: 'issueText', key: 'issueText' },
        ]}
      />

      <Table
        title={() => 'OCR 候选版本'}
        dataSource={candidateRows}
        size="small"
        pagination={false}
        locale={{ emptyText: '未触发多候选 OCR' }}
        columns={[
          { title: '文件', dataIndex: 'fileName', key: 'fileName', width: 220 },
          {
            title: '版本',
            dataIndex: 'variant',
            key: 'variant',
            width: 110,
            render: (variant: string, row: any) => <Tag color={row.selected ? 'blue' : 'default'}>{row.selected ? `${variant} 已选` : variant}</Tag>,
          },
          { title: '结构分', dataIndex: 'score', key: 'score', width: 90, render: (score: number) => `${formatPercent(score)}%` },
          { title: '表格数', dataIndex: 'tables', key: 'tables', width: 80 },
          { title: '锚点', dataIndex: 'anchorsFound', key: 'anchorsFound', width: 80 },
          { title: '提示', dataIndex: 'issueText', key: 'issueText' },
        ]}
      />

      <Table
        title={() => '机构库匹配状态'}
        dataSource={institutionRows}
        size="small"
        pagination={false}
        locale={{ emptyText: '暂无机构库匹配提示' }}
        columns={[
          { title: '来源位置', dataIndex: 'sourceText', key: 'sourceText', width: 260 },
          { title: '字段', dataIndex: 'field', key: 'field', width: 260 },
          { title: 'OCR 原文', dataIndex: 'original', key: 'original', width: 180 },
          { title: '输出/建议机构名', dataIndex: 'normalized', key: 'normalized', width: 220 },
          {
            title: '状态',
            key: 'status',
            width: 150,
            render: (_: unknown, row: any) => (
              <Tag color={INSTITUTION_STATUS_COLOR[row.status as InstitutionCorrectionDiagnostic['status']] ?? 'default'}>
                {row.statusLabel}
              </Tag>
            ),
          },
          {
            title: '置信度',
            key: 'confidence',
            width: 90,
            render: (_: unknown, row: any) => row.confidence > 0 ? `${Math.round(row.confidence * 100)}%` : '-',
          },
          {
            title: '是否采用',
            key: 'applied',
            width: 90,
            render: (_: unknown, row: any) => row.applied ? <Tag color="blue">已采用</Tag> : <Tag>原文保留</Tag>,
          },
          { title: '候选', dataIndex: 'candidatesText', key: 'candidatesText' },
        ]}
      />

      <Table
        title={() => (
          <div className="flex items-center justify-between gap-2">
            <span>字段与金额复核清单</span>
            <Space>
              {unreviewedIds.length > 0 && onReviewIssues && (
                <Button size="small" onClick={() => onReviewIssues(unreviewedIds)}>
                  全部标记已复核
                </Button>
              )}
              {reviewedCount > 0 && onClearReview && (
                <Button size="small" onClick={onClearReview}>
                  清除复核状态
                </Button>
              )}
            </Space>
          </div>
        )}
        dataSource={validationRows}
        size="small"
        pagination={false}
        locale={{ emptyText: '暂无字段一致性问题' }}
        columns={[
          {
            title: '级别',
            dataIndex: 'severity',
            key: 'severity',
            width: 90,
            render: (level: string) => {
              const color = level === 'critical' ? 'red' : level === 'warning' ? 'gold' : 'blue';
              const label = level === 'critical' ? '高风险' : level === 'warning' ? '需复核' : '提示';
              return <Tag color={color}>{label}</Tag>;
            },
          },
          { title: '类别', dataIndex: 'category', key: 'category', width: 120 },
          {
            title: '复核状态',
            key: 'reviewed',
            width: 110,
            render: (_: unknown, row: any) => {
              if (row.severity === 'info') return <Tag color="blue">无需确认</Tag>;
              return row.reviewed ? <Tag color="green">已复核</Tag> : <Tag color="red">未复核</Tag>;
            },
          },
          { title: '问题', dataIndex: 'message', key: 'message' },
          { title: '建议', dataIndex: 'suggestion', key: 'suggestion' },
          {
            title: '操作',
            key: 'action',
            width: 190,
            render: (_: unknown, row: any) => (
              <Space size="small">
                {onOpenIssue && (
                  <Button size="small" onClick={() => onOpenIssue(row.field)}>
                    去编辑
                  </Button>
                )}
                {(row.severity === 'critical' || row.severity === 'warning') && onReviewIssues && (
                  <Button
                    size="small"
                    type={row.reviewed ? 'default' : 'primary'}
                    disabled={row.reviewed}
                    onClick={() => onReviewIssues([row.id])}
                  >
                    标记已复核
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
    </>
  );
}

export default OcrQualityTab;
