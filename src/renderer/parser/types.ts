/** 章节树节点定义 */
export interface SectionNode {
  name: string;
  /** 子章节，无子章节时为空数组 */
  children: SectionNode[];
}

/**
 * 央行二代个人征信报告完整章节结构
 * 一级为报告主要模块，二级为各模块下的子章节
 */
export const REPORT_STRUCTURE: SectionNode[] = [
  { name: '报告头', children: [] },
  {
    name: '个人基本信息',
    children: [
      { name: '身份信息', children: [] },
      { name: '配偶信息', children: [] },
      { name: '居住信息', children: [] },
      { name: '职业信息', children: [] },
    ],
  },
  {
    name: '信息概要',
    children: [
      { name: '信贷交易信息提示', children: [] },
      { name: '信贷交易违约信息概要', children: [] },
      { name: '信贷交易授信及负债信息概要', children: [] },
    ],
  },
  {
    name: '信贷交易信息明细',
    children: [
      { name: '非循环贷账户', children: [] },
      { name: '循环贷账户', children: [] },
      { name: '贷记卡账户', children: [] },
      { name: '准贷记卡账户', children: [] },
    ],
  },
  { name: '非信贷交易信息明细', children: [] },
  {
    name: '公共信息明细',
    children: [
      { name: '住房公积金参缴记录', children: [] },
      { name: '养老保险金缴存记录', children: [] },
    ],
  },
  {
    name: '查询记录',
    children: [
      { name: '机构查询记录明细', children: [] },
      { name: '本人查询记录明细', children: [] },
    ],
  },
  { name: '本人声明', children: [] },
  { name: '异议标注', children: [] },
];

/** 从树结构中扁平化提取所有章节名（含一级和二级） */
function flattenNames(nodes: SectionNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    result.push(node.name);
    if (node.children.length > 0) {
      result.push(...flattenNames(node.children));
    }
  }
  return result;
}

/** 所平列表，用于分割匹配） */
export const ALL_SECTION_NAMES = flattenNames(REPORT_STRUCTURE);

export type SectionName = string;

/** 分割后的章节 */
export interface Section {
  name: SectionName | 'unknown';
  content: string;
  /** 章节在原文中的起始行号 */
  startLine: number;
  /** 章节层级：1=一级章节，2=二级章节 */
  level: number;
  /** 所属父章节名，一级章节为 null */
  parent: string | null;
}

/** 单个字段的提取结果 */
export interface ExtractedField<T = unknown> {
  value: T | null;
  confidence: number;
  /** 匹配到的原始文本片段，方便调试 */
  rawMatch: string | null;
}

