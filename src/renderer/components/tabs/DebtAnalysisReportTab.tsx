import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, message, Table, Tag, Typography } from 'antd';
import { DownloadOutlined, RobotOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { CreditReport } from '../../types/credit-report';
import {
  buildDebtAnalysisReport,
  type AnalysisInsight,
  type DebtBreakdownItem,
  type InstallmentCardItem,
  type PlanCalculationLine,
  type PaymentReductionPlan,
  type PlanImpactLevel,
} from '../../services/debt-analysis-report';
import { exportDebtAnalysisReportToDocx } from '../../services/debt-analysis-docx-export';
import {
  getProfessionalDebtAnalysis,
  type LlmDebtAnalysis,
  type LlmPlanComment,
  type LlmPriorityAction,
} from '../../services/debt-analysis-llm-service';
import { buildAnalysisReadiness, type AnalysisReadiness } from '../../services/analysis-readiness';
import { validateCreditReportData } from '../../services/credit-report-validation';
import type { OcrDiagnosticsReport, OcrReviewState } from '../../types/ocr-diagnostics';

interface DebtAnalysisReportTabProps {
  report: CreditReport;
  diagnostics?: OcrDiagnosticsReport;
  reviewState?: OcrReviewState;
}

const { Paragraph, Text } = Typography;

const IMPACT_COLOR: Record<PlanImpactLevel, string> = {
  低: 'green',
  中: 'gold',
  高: 'orange',
  极高: 'red',
};

const INSIGHT_COLOR: Record<AnalysisInsight['level'], string> = {
  正常: 'green',
  关注: 'gold',
  预警: 'orange',
  高风险: 'red',
};

function formatYuan(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} 元`;
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 1000) / 10}%`;
}

function formatReviewTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function renderTextList(items: string[]): React.ReactNode {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item} className="text-xs leading-5">{item}</div>
      ))}
    </div>
  );
}

function renderCalculationList(items: PlanCalculationLine[]): React.ReactNode {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={`${item.label}-${item.amount}`} className="text-xs leading-5">
          <Text strong>{item.label}</Text>：{formatYuan(item.amount)}
          <div className="text-gray-500">{item.explanation}</div>
        </div>
      ))}
    </div>
  );
}

const DebtAnalysisReportTab: React.FC<DebtAnalysisReportTabProps> = ({ report, diagnostics, reviewState }) => {
  const analysis = useMemo(() => buildDebtAnalysisReport(report), [report]);
  const validation = useMemo(() => validateCreditReportData(report), [report]);
  const readiness = useMemo(() => buildAnalysisReadiness(validation, reviewState), [reviewState, validation]);
  const canExport = Boolean(analysis.reportNo || analysis.debtTotal > 0 || analysis.originalMonthlyPayment > 0);
  const canRunAnalysisActions = canExport && !readiness.blocked;
  const [aiAnalysis, setAiAnalysis] = useState<LlmDebtAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    setAiAnalysis(null);
    setAiError('');
  }, [report, readiness.blocked]);

  const handleExportDocx = useCallback(() => {
    if (!canExport) {
      message.warning('暂无可导出的分析数据');
      return;
    }
    if (readiness.blocked) {
      message.warning(readiness.actionHint);
      return;
    }
    exportDebtAnalysisReportToDocx(report, undefined, aiAnalysis ?? undefined, reviewState, diagnostics);
    message.success('分析报告已导出');
  }, [aiAnalysis, canExport, diagnostics, readiness, report, reviewState]);

  const handleAiAnalysis = useCallback(async () => {
    if (!canExport) {
      message.warning('暂无可分析的数据');
      return;
    }
    if (readiness.blocked) {
      message.warning(readiness.actionHint);
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const result = await getProfessionalDebtAnalysis(analysis);
      setAiAnalysis(result);
      message.success('AI 专业分析已生成');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 分析失败';
      setAiError(msg);
      message.error('AI 分析失败，请检查 DeepSeek 配置或稍后重试');
    } finally {
      setAiLoading(false);
    }
  }, [analysis, canExport, readiness]);

  const debtColumns: ColumnsType<DebtBreakdownItem> = [
    { title: '债务类别', dataIndex: 'label', key: 'label', width: 140 },
    { title: '账户数', dataIndex: 'count', key: 'count', width: 90, align: 'right' },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 140,
      align: 'right',
      render: (value: number) => formatYuan(value),
    },
    {
      title: '余额占比',
      key: 'share',
      width: 100,
      align: 'right',
      render: (_, record) => formatRatio(record.balanceShare),
    },
    {
      title: '月供占比',
      key: 'paymentShare',
      width: 100,
      align: 'right',
      render: (_, record) => formatRatio(record.paymentShare),
    },
    {
      title: '本月应还',
      dataIndex: 'monthlyPayment',
      key: 'monthlyPayment',
      width: 140,
      align: 'right',
      render: (value: number) => formatYuan(value),
    },
    {
      title: '月供密度',
      dataIndex: 'paymentRate',
      key: 'paymentRate',
      width: 100,
      align: 'right',
      render: (value: number | null) => formatRatio(value),
    },
  ];

  const cardColumns: ColumnsType<InstallmentCardItem> = [
    { title: '发卡机构', dataIndex: 'org', key: 'org', width: 200 },
    {
      title: '授信额度',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      width: 120,
      align: 'right',
      render: (value: number) => formatYuan(value),
    },
    {
      title: '已用额度',
      dataIndex: 'usedAmount',
      key: 'usedAmount',
      width: 120,
      align: 'right',
      render: (value: number) => formatYuan(value),
    },
    {
      title: '可用额度',
      dataIndex: 'availableLimit',
      key: 'availableLimit',
      width: 120,
      align: 'right',
      render: (value: number) => formatYuan(value),
    },
    {
      title: '使用率',
      dataIndex: 'usageRate',
      key: 'usageRate',
      width: 90,
      align: 'right',
      render: (value: number | null) => formatRatio(value),
    },
    {
      title: '本月应还',
      dataIndex: 'monthlyPayment',
      key: 'monthlyPayment',
      width: 120,
      align: 'right',
      render: (value: number) => formatYuan(value),
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
    { title: '核查提示', dataIndex: 'reason', key: 'reason', width: 220 },
  ];

  const planColumns: ColumnsType<PaymentReductionPlan> = [
    { title: '方案', dataIndex: 'name', key: 'name', width: 150, fixed: 'left' },
    {
      title: '征信影响',
      dataIndex: 'impactLevel',
      key: 'impactLevel',
      width: 90,
      render: (level: PlanImpactLevel) => <Tag color={IMPACT_COLOR[level]}>{level}</Tag>,
    },
    {
      title: '原月供',
      dataIndex: 'originalMonthlyPayment',
      key: 'originalMonthlyPayment',
      width: 120,
      align: 'right',
      render: (value: number) => formatYuan(value),
    },
    {
      title: '预计月供',
      dataIndex: 'targetMonthlyPayment',
      key: 'targetMonthlyPayment',
      width: 120,
      align: 'right',
      render: (value: number) => formatYuan(value),
    },
    {
      title: '释放现金流',
      dataIndex: 'releasedCashFlow',
      key: 'releasedCashFlow',
      width: 130,
      align: 'right',
      render: (value: number) => <Text strong>{formatYuan(value)}</Text>,
    },
    {
      title: '测算明细',
      dataIndex: 'calculations',
      key: 'calculations',
      width: 320,
      render: (items: PlanCalculationLine[]) => renderCalculationList(items),
    },
    { title: '测算依据', dataIndex: 'basis', key: 'basis', width: 260 },
    {
      title: '优势',
      dataIndex: 'advantages',
      key: 'advantages',
      width: 220,
      render: (items: string[]) => renderTextList(items),
    },
    {
      title: '风险',
      dataIndex: 'risks',
      key: 'risks',
      width: 260,
      render: (items: string[]) => renderTextList(items),
    },
    { title: '合规提示', dataIndex: 'complianceNote', key: 'complianceNote', width: 280 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <Alert
          className="flex-1"
          type="info"
          showIcon
          title="征信数据分析报告"
          description="本页基于 OCR 结构化结果生成债务结构、月供压力和方案对比。所有金额以征信原文和机构账单复核为准，方案仅用于现金流分析。"
        />
        <Button
          icon={<RobotOutlined />}
          onClick={handleAiAnalysis}
          disabled={!canRunAnalysisActions}
          loading={aiLoading}
        >
          AI 专业分析
        </Button>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExportDocx}
          disabled={!canRunAnalysisActions}
        >
          导出 Word
        </Button>
      </div>

      {canExport && <AnalysisReadinessAlert readiness={readiness} />}
      {canExport && <AnalysisReviewConfirmedAlert readiness={readiness} reviewState={reviewState} />}

      <Card size="small" title="客户债务总览">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Metric label="债务总额" value={formatYuan(analysis.debtTotal)} />
          <Metric label="债务账户" value={`${analysis.debtCount} 笔`} />
          <Metric label="贷款余额" value={formatYuan(analysis.totalLoanBalance)} />
          <Metric label="信用卡已用" value={formatYuan(analysis.totalCardUsed)} />
          <Metric label="当前月供" value={formatYuan(analysis.originalMonthlyPayment)} />
          <Metric label="非房贷占比" value={formatRatio(analysis.metrics.nonMortgageDebtShare)} />
          <Metric label="信用卡使用率" value={formatRatio(analysis.metrics.cardUsageRate)} />
          <Metric label="当前逾期账户" value={`${analysis.metrics.overdueAccountCount} 个`} />
        </div>
        <Descriptions size="small" column={2}>
          <Descriptions.Item label="客户姓名">{analysis.customerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="报告时间">{analysis.reportTime || '-'}</Descriptions.Item>
          <Descriptions.Item label="报告编号">{analysis.reportNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="信用卡总授信">{formatYuan(analysis.totalCardLimit)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" title="结构洞察">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {analysis.insights.map((insight) => (
            <div key={insight.key} className="border border-gray-100 rounded px-3 py-2 bg-gray-50">
              <div className="flex items-center justify-between gap-2 mb-1">
                <Text strong>{insight.title}</Text>
                <Tag color={INSIGHT_COLOR[insight.level]}>{insight.level}</Tag>
              </div>
              <Paragraph className="mb-2 text-sm">{insight.description}</Paragraph>
              <div className="text-xs text-gray-500 mb-2">
                {insight.evidence.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
              <div className="text-xs text-blue-600">{insight.suggestion}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card
        size="small"
        title={
          <div className="flex items-center gap-2">
            <RobotOutlined />
            <span>AI 专业建议</span>
          </div>
        }
      >
        {aiError && (
          <Alert type="error" showIcon title="AI 分析失败" description={aiError} className="mb-3" />
        )}
        {aiAnalysis ? (
          <AiAnalysisContent analysis={aiAnalysis} />
        ) : (
          <div className="text-sm text-gray-500">
            点击“AI 专业分析”后，DeepSeek 会基于上方确定性数据生成综合判断、处理优先级、执行步骤和资料清单。
          </div>
        )}
      </Card>

      <Card size="small" title="债务清单明细">
        <Table
          rowKey="key"
          dataSource={analysis.debtBreakdown}
          columns={debtColumns}
          size="small"
          pagination={false}
          locale={{ emptyText: '暂未识别到有效债务明细' }}
        />
      </Card>

      <Card size="small" title="可分期信用卡清单">
        <Table
          rowKey="key"
          dataSource={analysis.installmentCards}
          columns={cardColumns}
          size="small"
          pagination={false}
          scroll={{ x: 1100 }}
          locale={{ emptyText: '暂未识别到有已用额度的信用卡账户' }}
        />
      </Card>

      <Card size="small" title="降低月供方案对比">
        <Table
          rowKey="key"
          dataSource={analysis.plans}
          columns={planColumns}
          size="small"
          pagination={false}
          scroll={{ x: 1600 }}
        />
      </Card>

      <Card size="small" title="方案说明与建议">
        <div className="space-y-3">
          <div>
            <Text strong>核心结论</Text>
            {analysis.summary.map((line) => (
              <Paragraph key={line} className="mb-1">{line}</Paragraph>
            ))}
          </div>
          <div>
            <Text strong>风险提示</Text>
            {analysis.riskNotes.map((line) => (
              <Paragraph key={line} className="mb-1">{line}</Paragraph>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

const AnalysisReadinessAlert: React.FC<{ readiness: AnalysisReadiness }> = ({ readiness }) => {
  if (!readiness.blocked) return null;

  return (
    <Alert
      type={readiness.alertType}
      showIcon
      title={`OCR 关键字段需复核：${readiness.reason}`}
      description={
        <div className="space-y-2">
          <div>
            已暂缓 AI 专业分析和 Word 导出。请先在“解析质量”页或明细页核对金额、账户状态和账户数量，避免错误数据进入后续报告。
          </div>
          <div className="space-y-1">
            {readiness.displayIssues.map((issue) => (
              <div key={issue.id} className="text-xs leading-5">
                <Text strong>{issue.category}</Text>：{issue.message}
                <span className="text-gray-500">｜{issue.suggestion}</span>
              </div>
            ))}
            {readiness.hiddenIssueCount > 0 && (
              <div className="text-xs text-gray-500">另有 {readiness.hiddenIssueCount} 项需复核。</div>
            )}
          </div>
        </div>
      }
    />
  );
};

const AnalysisReviewConfirmedAlert: React.FC<{
  readiness: AnalysisReadiness;
  reviewState?: OcrReviewState;
}> = ({ readiness, reviewState }) => {
  if (readiness.blocked || readiness.reviewedIssueCount === 0) return null;

  return (
    <Alert
      type="success"
      showIcon
      title="OCR 复核已确认，已恢复 AI 分析和 Word 导出"
      description={`已人工复核 ${readiness.reviewedIssueCount} 项字段问题${
        reviewState?.reviewedAt ? `，确认时间：${formatReviewTime(reviewState.reviewedAt)}` : ''
      }。后续如继续修改字段，系统会重新要求复核。`}
    />
  );
};

const AiAnalysisContent: React.FC<{ analysis: LlmDebtAnalysis }> = ({ analysis }) => (
  <div className="space-y-4">
    <div>
      <Text strong>综合判断</Text>
      <Paragraph className="mb-0 mt-1">{analysis.executiveSummary || '暂无综合判断'}</Paragraph>
    </div>

    {analysis.primaryPressureSources.length > 0 && (
      <div>
        <Text strong>主要压力来源</Text>
        <div className="flex flex-wrap gap-1 mt-2">
          {analysis.primaryPressureSources.map((item) => (
            <Tag key={item} color="blue">{item}</Tag>
          ))}
        </div>
      </div>
    )}

    {analysis.priorityActions.length > 0 && (
      <div>
        <Text strong>优先处理动作</Text>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
          {analysis.priorityActions.map((item) => (
            <PriorityActionCard key={`${item.priority}-${item.title}`} item={item} />
          ))}
        </div>
      </div>
    )}

    {analysis.planComments.length > 0 && (
      <div>
        <Text strong>方案适用性点评</Text>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
          {analysis.planComments.map((item) => (
            <PlanCommentCard key={`${item.planKey}-${item.planName}`} item={item} />
          ))}
        </div>
      </div>
    )}

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <CompactList title="执行步骤" items={analysis.executionSteps} />
      <CompactList title="补充核验资料" items={analysis.requiredMaterials} />
      <CompactList title="风险提示" items={analysis.riskWarnings} />
    </div>
  </div>
);

const PriorityActionCard: React.FC<{ item: LlmPriorityAction }> = ({ item }) => (
  <div className="border border-gray-100 rounded px-3 py-2 bg-gray-50">
    <div className="flex items-center gap-2 mb-1">
      <Tag color="processing">#{item.priority}</Tag>
      <Text strong>{item.title}</Text>
    </div>
    <Paragraph className="mb-1 text-sm">{item.reason}</Paragraph>
    <div className="text-xs text-blue-600 mb-1">{item.action}</div>
    {item.evidence.length > 0 && (
      <div className="text-xs text-gray-500">
        {item.evidence.map((evidence) => <div key={evidence}>{evidence}</div>)}
      </div>
    )}
  </div>
);

const PlanCommentCard: React.FC<{ item: LlmPlanComment }> = ({ item }) => (
  <div className="border border-gray-100 rounded px-3 py-2 bg-gray-50">
    <Text strong>{item.planName}</Text>
    <Paragraph className="mb-2 text-sm">{item.suitability}</Paragraph>
    <div className="grid grid-cols-1 gap-2">
      <CompactList title="执行前提" items={item.prerequisites} />
      <CompactList title="注意事项" items={item.cautions} />
    </div>
  </div>
);

const CompactList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <div>
    <div className="text-xs font-medium text-gray-500 mb-1">{title}</div>
    {items.length > 0 ? (
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item} className="text-xs leading-5">{item}</div>
        ))}
      </div>
    ) : (
      <div className="text-xs text-gray-400">暂无</div>
    )}
  </div>
);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border border-gray-100 rounded px-3 py-2 bg-gray-50">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className="text-base font-semibold text-gray-900">{value}</div>
  </div>
);

export default DebtAnalysisReportTab;
