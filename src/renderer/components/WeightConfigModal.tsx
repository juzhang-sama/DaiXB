/**
 * 权重配置弹窗 — 环形饼图 + 权重输入
 *
 * 创建/编辑产品后弹出，用户为每个准入条件分配权重（总和=100）
 * 饼图实时联动，直观展示各条件占比
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Modal, InputNumber, message } from 'antd';
import type { ConditionRule } from '../types/product-rule';

interface WeightConfigModalProps {
  open: boolean;
  conditions: ConditionRule[];
  onSave: (conditions: ConditionRule[]) => void;
  onCancel: () => void;
}

const COLORS = [
  '#5B8FF9', '#5AD8A6', '#F6BD16', '#E86452',
  '#6DC8EC', '#945FB9', '#FF9845', '#1E9493',
];

interface ChartDatum {
  label: string;
  value: number;
}

const DONUT_RADIUS = 78;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const WeightDonutChart: React.FC<{ data: ChartDatum[]; totalWeight: number }> = ({ data, totalWeight }) => {
  const positiveData = data.filter(item => item.value > 0);
  const denominator = positiveData.reduce((sum, item) => sum + item.value, 0);
  let accumulated = 0;

  const segments = positiveData.map((item, index) => {
    const length = denominator > 0 ? (item.value / denominator) * DONUT_CIRCUMFERENCE : 0;
    const segment = {
      ...item,
      color: COLORS[index % COLORS.length],
      offset: accumulated,
      length,
    };
    accumulated += length;
    return segment;
  });

  return (
    <div className="relative h-[280px] flex items-center justify-center">
      <svg viewBox="0 0 220 220" className="h-[240px] w-[240px]" role="img" aria-label="权重占比">
        <circle
          cx="110"
          cy="110"
          r={DONUT_RADIUS}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="24"
        />
        {segments.map(segment => (
          <circle
            key={segment.label}
            cx="110"
            cy="110"
            r={DONUT_RADIUS}
            fill="none"
            stroke={segment.color}
            strokeWidth="24"
            strokeLinecap="round"
            strokeDasharray={`${segment.length} ${DONUT_CIRCUMFERENCE - segment.length}`}
            strokeDashoffset={-segment.offset}
            transform="rotate(-90 110 110)"
          >
            <title>{`${segment.label}: ${segment.value}`}</title>
          </circle>
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className={`text-3xl font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-red-500'}`}>
          {totalWeight}
        </div>
        <div className="text-xs text-gray-400">/ 100</div>
      </div>
    </div>
  );
};

const WeightConfigModal: React.FC<WeightConfigModalProps> = ({
  open, conditions, onSave, onCancel,
}) => {
  const [weights, setWeights] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const c of conditions) m.set(c.field, c.weight ?? 0);
    return m;
  });

  // 条件变化时重置
  React.useEffect(() => {
    const m = new Map<string, number>();
    for (const c of conditions) m.set(c.field, c.weight ?? 0);
    setWeights(m);
  }, [conditions]);

  const totalWeight = useMemo(() => {
    let sum = 0;
    for (const w of weights.values()) sum += w;
    return sum;
  }, [weights]);

  const updateWeight = useCallback((field: string, value: number) => {
    setWeights(prev => {
      const next = new Map(prev);
      next.set(field, value);
      return next;
    });
  }, []);

  const chartData = useMemo(() => {
    return conditions.map(c => ({
      label: c.label,
      value: weights.get(c.field) ?? 0,
    }));
  }, [conditions, weights]);

  const handleOk = () => {
    if (totalWeight !== 100) {
      message.warning(`权重总和为 ${totalWeight}，必须等于 100`);
      return;
    }
    const updated = conditions.map(c => ({
      ...c,
      weight: weights.get(c.field) ?? 0,
    }));
    onSave(updated);
  };

  return (
    <Modal
      title="配置权重"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="确认"
      cancelText="取消"
      width={600}
      okButtonProps={{ disabled: totalWeight !== 100 }}
      destroyOnHidden
    >
      <div className="flex gap-6">
        {/* 左：饼图 */}
        <div className="flex-1 min-w-[240px]">
          <WeightDonutChart data={chartData} totalWeight={totalWeight} />
        </div>
        {/* 右：条件权重列表 */}
        <div className="w-[200px] space-y-2 pt-2">
          {conditions.map((c, i) => (
            <div key={c.field} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-xs text-gray-600 flex-1 truncate">{c.label}</span>
              <InputNumber
                size="small" className="w-16" min={0} max={100}
                value={weights.get(c.field) ?? 0}
                onChange={v => updateWeight(c.field, v ?? 0)}
              />
            </div>
          ))}
          <div className={`text-xs pt-2 border-t border-gray-100 ${totalWeight === 100 ? 'text-green-600' : 'text-red-500'}`}>
            总计：{totalWeight} / 100
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default WeightConfigModal;
