/**
 * 权重配置弹窗 — 环形饼图 + 权重输入
 *
 * 创建/编辑产品后弹出，用户为每个准入条件分配权重（总和=100）
 * 饼图实时联动，直观展示各条件占比
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Modal, InputNumber, message } from 'antd';
import { Pie } from '@ant-design/charts';
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

  const pieConfig = {
    data: chartData,
    angleField: 'value',
    colorField: 'label',
    innerRadius: 0.6,
    radius: 0.9,
    height: 280,
    color: COLORS,
    label: {
      text: (d: { label: string; value: number }) => d.value > 0 ? `${d.value}` : '',
      style: { fontSize: 12, fontWeight: 500 },
    },
    legend: false as const,
    tooltip: {
      title: 'label',
    },
    annotations: [{
      type: 'text' as const,
      style: {
        text: `${totalWeight}`,
        x: '50%',
        y: '46%',
        textAlign: 'center' as const,
        fontSize: 28,
        fontWeight: 700,
        fill: totalWeight === 100 ? '#52c41a' : '#ff4d4f',
      },
    }, {
      type: 'text' as const,
      style: {
        text: '/ 100',
        x: '50%',
        y: '56%',
        textAlign: 'center' as const,
        fontSize: 12,
        fill: '#999',
      },
    }],
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
      destroyOnClose
    >
      <div className="flex gap-6">
        {/* 左：饼图 */}
        <div className="flex-1 min-w-[240px]">
          <Pie {...pieConfig} />
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

