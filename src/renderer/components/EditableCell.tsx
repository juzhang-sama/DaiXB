import React, { useState, useRef, useEffect } from 'react';
import { InputNumber, Input } from 'antd';

interface EditableCellProps {
  value: string | number | null | undefined;
  type?: 'string' | 'number';
  onChange: (val: any) => void;
  placeholder?: string;
  formatter?: (val: number) => string;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value, type, onChange, placeholder = '-', formatter,
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<any>(null);

  const resolvedType = type ?? (typeof value === 'number' ? 'number' : 'string');

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleBlur = () => setEditing(false);

  if (editing) {
    if (resolvedType === 'number') {
      return (
        <InputNumber
          ref={inputRef}
          size="small"
          value={typeof value === 'number' ? value : undefined}
          onChange={(v) => {
            if (v !== null && v !== undefined) onChange(v);
            else onChange(0);
          }}
          onBlur={handleBlur}
          onPressEnter={handleBlur}
          className="w-full"
        />
      );
    }
    return (
      <Input
        ref={inputRef}
        size="small"
        value={value?.toString() ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        onPressEnter={handleBlur}
      />
    );
  }

  const displayValue = formatDisplay(value, resolvedType, formatter, placeholder);

  return (
    <span
      className="cursor-pointer hover:bg-blue-50 px-1 rounded min-w-[2em] inline-block"
      onClick={() => setEditing(true)}
      title="点击编辑"
    >
      {displayValue}
    </span>
  );
};

function formatDisplay(
  value: string | number | null | undefined,
  type: string,
  formatter?: (val: number) => string,
  placeholder = '-',
): React.ReactNode {
  if (value === null || value === undefined || value === '') return placeholder;
  if (type === 'number' && typeof value === 'number') {
    return formatter ? formatter(value) : value.toLocaleString('zh-CN');
  }
  return String(value);
}

export default EditableCell;

