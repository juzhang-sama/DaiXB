import React from 'react';
import { Form, Input, InputNumber, Select, Card, Spin } from 'antd';
import { ClientProfile, ConfidenceMap, CONFIDENCE_THRESHOLD } from '../types/client-profile';

const FIELD_PAGE_MAP: Record<string, number> = {
  name: 1, age: 1, marriage: 1, company: 1,
  q1m: 2, q2m: 2, q6m: 2,
  overdueCurrent: 3, overdueHistory: 3,
  totalCreditLimit: 4, usedCreditLimit: 4,
  monthlyRepayment: 4, monthlyIncome: 4,
};

interface CreditFormProps {
  profile: ClientProfile;
  confidence: ConfidenceMap;
  onChange: (profile: ClientProfile) => void;
  loading: boolean;
  onFieldFocus: (page: number) => void;
}

function isLow(conf: ConfidenceMap, f: keyof ClientProfile): boolean {
  const v = conf[f];
  return typeof v === 'number' && v < CONFIDENCE_THRESHOLD;
}

function cip(conf: ConfidenceMap, f: keyof ClientProfile) {
  if (!isLow(conf, f)) return {};
  const v = conf[f] as number;
  return { validateStatus: 'warning' as const, help: `置信度 ${Math.round(v * 100)}%，请人工核对数字准确性` };
}

function cis(conf: ConfidenceMap, f: keyof ClientProfile): React.CSSProperties {
  return isLow(conf, f) ? { borderColor: '#ff4d4f' } : {};
}

const CreditForm: React.FC<CreditFormProps> = ({ profile, confidence, onChange, loading, onFieldFocus }) => {
  const update = <K extends keyof ClientProfile>(key: K, val: ClientProfile[K]) => {
    onChange({ ...profile, [key]: val });
  };
  const fp = (field: string) => ({
    onFocus: () => { const p = FIELD_PAGE_MAP[field]; if (p) onFieldFocus(p); },
  });

  return (
    <Spin spinning={loading} description="正在解析征信报告...">
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">征信报告解析</h2>

        <Card title="基本信息" size="small" className="mb-4">
          <Form layout="vertical" size="small">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="姓名" {...cip(confidence, 'name')}>
                <Input style={cis(confidence, 'name')} value={profile.name} onChange={(e) => update('name', e.target.value)} {...fp('name')} />
              </Form.Item>
              <Form.Item label="年龄" {...cip(confidence, 'age')}>
                <InputNumber className="w-full" style={cis(confidence, 'age')} value={profile.age} onChange={(v) => update('age', v)} {...fp('age')} />
              </Form.Item>
              <Form.Item label="婚姻状况" {...cip(confidence, 'marriage')}>
                <Select value={profile.marriage} onChange={(v) => update('marriage', v)} options={[
                  { label: '未婚', value: 'single' },
                  { label: '已婚', value: 'married' },
                  { label: '离异', value: 'divorced' },
                ]} {...fp('marriage')} />
              </Form.Item>
              <Form.Item label="工作单位" {...cip(confidence, 'company')}>
                <Input style={cis(confidence, 'company')} value={profile.company} onChange={(e) => update('company', e.target.value)} {...fp('company')} />
              </Form.Item>
            </div>
          </Form>
        </Card>

        <Card title="查询压力" size="small" className="mb-4">
          <Form layout="vertical" size="small">
            <div className="grid grid-cols-3 gap-x-4">
              <Form.Item label="近1个月查询次数" {...cip(confidence, 'q1m')}>
                <InputNumber className="w-full" style={cis(confidence, 'q1m')} min={0} value={profile.q1m} onChange={(v) => update('q1m', v)} {...fp('q1m')} />
              </Form.Item>
              <Form.Item label="近2个月查询次数" {...cip(confidence, 'q2m')}>
                <InputNumber className="w-full" style={cis(confidence, 'q2m')} min={0} value={profile.q2m} onChange={(v) => update('q2m', v)} {...fp('q2m')} />
              </Form.Item>
              <Form.Item label="近6个月查询次数" {...cip(confidence, 'q6m')}>
                <InputNumber className="w-full" style={cis(confidence, 'q6m')} min={0} value={profile.q6m} onChange={(v) => update('q6m', v)} {...fp('q6m')} />
              </Form.Item>
            </div>
          </Form>
        </Card>

        <Card title="逾期记录" size="small" className="mb-4">
          <Form layout="vertical" size="small">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="当前是否有逾期" {...cip(confidence, 'overdueCurrent')}>
                <Select value={profile.overdueCurrent} onChange={(v) => update('overdueCurrent', v)} options={[
                  { label: '否', value: false },
                  { label: '是', value: true },
                ]} {...fp('overdueCurrent')} />
              </Form.Item>
              <Form.Item label="历史最高逾期等级" {...cip(confidence, 'overdueHistory')}>
                <InputNumber className="w-full" style={cis(confidence, 'overdueHistory')} min={0} max={7} value={profile.overdueHistory} onChange={(v) => update('overdueHistory', v)} {...fp('overdueHistory')} />
              </Form.Item>
            </div>
          </Form>
        </Card>

        <Card title="负债情况" size="small" className="mb-4">
          <Form layout="vertical" size="small">
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item label="信用卡总授信 (万元)" {...cip(confidence, 'totalCreditLimit')}>
                <InputNumber className="w-full" style={cis(confidence, 'totalCreditLimit')} min={0} value={profile.totalCreditLimit} onChange={(v) => update('totalCreditLimit', v)} {...fp('totalCreditLimit')} />
              </Form.Item>
              <Form.Item label="信用卡已用额度 (万元)" {...cip(confidence, 'usedCreditLimit')}>
                <InputNumber className="w-full" style={cis(confidence, 'usedCreditLimit')} min={0} value={profile.usedCreditLimit} onChange={(v) => update('usedCreditLimit', v)} {...fp('usedCreditLimit')} />
              </Form.Item>
              <Form.Item label="贷款月供合计 (元)" {...cip(confidence, 'monthlyRepayment')}>
                <InputNumber className="w-full" style={cis(confidence, 'monthlyRepayment')} min={0} value={profile.monthlyRepayment} onChange={(v) => update('monthlyRepayment', v)} {...fp('monthlyRepayment')} />
              </Form.Item>
              <Form.Item label="月收入 (元)" {...cip(confidence, 'monthlyIncome')}>
                <InputNumber className="w-full" style={cis(confidence, 'monthlyIncome')} min={0} value={profile.monthlyIncome} onChange={(v) => update('monthlyIncome', v)} {...fp('monthlyIncome')} />
              </Form.Item>
            </div>
          </Form>
        </Card>
      </div>
    </Spin>
  );
};

export default CreditForm;
