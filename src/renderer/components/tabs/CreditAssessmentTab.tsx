/**
 * 征信评估 Tab — 六维度事实画像 + 风险等级标注
 *
 * 展示 CreditProfile 经评估引擎分析后的客观事实指标
 * 无综合评分，每个维度独立展示风险等级（正常/关注/警告/危险）
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Card, Tag, Button, Descriptions } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import type { CreditReport } from '../../types/credit-report';
import type { RiskLevel } from '../../services/assessment-config-default';
import { buildCreditProfile } from '../../services/credit-profile-builder';
import { assessCredit } from '../../services/credit-assessment';
import type { DimensionResult, Indicator } from '../../services/credit-assessment';
import { getLLMComments } from '../../services/llm-service';
import type { LLMComments } from '../../services/llm-service';

interface CreditAssessmentTabProps {
  report: CreditReport;
}

const LEVEL_COLOR: Record<RiskLevel, string> = {
  '正常': '#52c41a', '关注': '#faad14', '警告': '#fa8c16', '危险': '#ff4d4f',
};

const LEVEL_BG: Record<RiskLevel, string> = {
  '正常': '#f6ffed', '关注': '#fffbe6', '警告': '#fff7e6', '危险': '#fff2f0',
};

const TAG_COLOR_MAP: Record<string, string> = {
  '当前逾期': 'red', '呆账': 'red', '代偿': 'red',
  '连三': 'red', '累六': 'orange',
  '数据不足': 'gold', '未知': 'default',
  '房贷': 'green', '车贷': 'green', '授信较高': 'green', '已结清': 'blue',
};

/** 根据标签内容匹配颜色 */
function getTagColor(tag: string): string {
  for (const [keyword, color] of Object.entries(TAG_COLOR_MAP)) {
    if (tag.includes(keyword)) return color;
  }
  return 'default';
}

/** 单条指标行 */
const IndicatorRow: React.FC<{ ind: Indicator }> = ({ ind }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-500">{ind.label}</span>
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-800">{ind.display}</span>
      <span
        className="text-xs px-1.5 py-0.5 rounded"
        style={{ color: LEVEL_COLOR[ind.level], backgroundColor: LEVEL_BG[ind.level] }}
      >
        {ind.level}
      </span>
    </div>
  </div>
);

/** 单维度卡片 */
const DimensionCard: React.FC<{ dim: DimensionResult; comment?: string }> = ({ dim, comment }) => (
  <Card
    size="small"
    title={
      <div className="flex items-center justify-between">
        <span>{dim.label}</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-normal"
          style={{ color: LEVEL_COLOR[dim.level], backgroundColor: LEVEL_BG[dim.level] }}
        >
          {dim.level}
        </span>
      </div>
    }
    className="h-full"
    style={{ borderTop: `3px solid ${LEVEL_COLOR[dim.level]}` }}
  >
    {dim.indicators.map((ind, i) => <IndicatorRow key={i} ind={ind} />)}
    {comment && (
      <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 mt-2">
        <RobotOutlined className="mr-1" />{comment}
      </div>
    )}
    {dim.tags.length > 0 && (
      <div className="flex flex-wrap gap-1 mt-2">
        {dim.tags.map((tag, i) => (
          <Tag key={i} color={getTagColor(tag)} className="text-xs">{tag}</Tag>
        ))}
      </div>
    )}
  </Card>
);

const CreditAssessmentTab: React.FC<CreditAssessmentTabProps> = ({ report }) => {
  const profile = useMemo(() => buildCreditProfile(report), [report]);
  const result = useMemo(() => assessCredit(profile), [profile]);

  const [comments, setComments] = useState<LLMComments | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string>('');

  const handleLlmAnalysis = useCallback(async () => {
    setLlmLoading(true);
    setLlmError('');
    try {
      const res = await getLLMComments(profile, result);
      setComments(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分析失败';
      setLlmError(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [profile, result]);

  const dims = result.dimensions;
  const dc = comments?.dimensions;

  return (
    <div className="space-y-4">
      {/* 硬伤摘要 + AI 点评 */}
      <Card size="small">
        <div className="flex items-center gap-4">
          {result.hardInjuryTags.length > 0 ? (
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-1">硬伤标注</div>
              <div className="flex flex-wrap gap-1">
                {result.hardInjuryTags.map((tag, i) => (
                  <Tag key={i} color={getTagColor(tag)} className="text-xs">{tag}</Tag>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 text-sm text-green-600">征信无明显硬伤</div>
          )}
          <Button
            type="primary"
            icon={<RobotOutlined />}
            loading={llmLoading}
            onClick={handleLlmAnalysis}
            disabled={!report.header.reportNo}
          >
            {comments ? '重新分析' : 'AI 点评'}
          </Button>
        </div>
        {llmError && (
          <div className="text-red-500 text-xs mt-2">{llmError}</div>
        )}
        {comments?.overall && (
          <div className="text-sm text-blue-600 bg-blue-50 rounded px-3 py-2 mt-3">
            <RobotOutlined className="mr-1" />{comments.overall}
          </div>
        )}
      </Card>

      {/* 六维度事实卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <DimensionCard dim={dims.basicAccess} comment={dc?.basicAccess} />
        <DimensionCard dim={dims.hardInjury} comment={dc?.hardInjury} />
        <DimensionCard dim={dims.debtStatus} comment={dc?.debtStatus} />
        <DimensionCard dim={dims.queryFrequency} comment={dc?.queryFrequency} />
        <DimensionCard dim={dims.assetStatus} comment={dc?.assetStatus} />
        <DimensionCard dim={dims.creditHistory} comment={dc?.creditHistory} />
      </div>

      {/* 数据说明 */}
      <Card size="small" title="数据说明" className="text-xs text-gray-400">
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="评估方式">
            客观事实展示 + 行业通用红线标注，不含加权评分
          </Descriptions.Item>
          <Descriptions.Item label="数据完整度">
            {result.hardInjuryTags.some(t => t.includes('数据不足'))
              ? '部分数据不足（还款记录 OCR 暂不支持），连三累六暂无法判断'
              : '数据完整'}
          </Descriptions.Item>
          <Descriptions.Item label="免责说明">
            评估结果仅供参考，不构成任何信贷决策建议
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default CreditAssessmentTab;
