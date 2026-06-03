import { Section, SectionName, ALL_SECTION_NAMES, REPORT_STRUCTURE, SectionNode } from './types';

/** 构建子章节 → 父章节的映射 */
function buildParentMap(nodes: SectionNode[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const node of nodes) {
    map.set(node.name, null);
    for (const child of node.children) {
      map.set(child.name, node.name);
    }
  }
  return map;
}

/** 构建章节名 → 层级的映射 */
function buildLevelMap(nodes: SectionNode[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const node of nodes) {
    map.set(node.name, 1);
    for (const child of node.children) {
      map.set(child.name, 2);
    }
  }
  return map;
}

const PARENT_MAP = buildParentMap(REPORT_STRUCTURE);
const LEVEL_MAP = buildLevelMap(REPORT_STRUCTURE);

/**
 * 将征信报告全文按章节标题切分（支持一级/二级层级）
 * 央行二代征信报告格式固定，按已知标题做分割
 */
export function splitSections(fullText: string): Section[] {
  const lines = fullText.split('\n');
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const matched = matchSectionTitle(trimmed);
    if (matched) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        name: matched,
        content: '',
        startLine: i,
        level: LEVEL_MAP.get(matched) ?? 1,
        parent: PARENT_MAP.get(matched) ?? null,
      };
    } else if (currentSection) {
      currentSection.content += trimmed + '\n';
    } else {
      if (!sections.length || sections[sections.length - 1].name !== 'unknown') {
        currentSection = { name: 'unknown', content: trimmed + '\n', startLine: i, level: 0, parent: null };
      } else {
        sections[sections.length - 1].content += trimmed + '\n';
      }
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
}

/**
 * 模糊匹配章节标题，容忍 OCR 识别中的空格、中文数字前缀和轻微错字
 * OCR 常见格式：一个人基本信息、二信息概要、三信贷交易信息明细、四查询记录
 * 以及带括号的子章节：(一)身份信息、(二)配偶信息
 */
function matchSectionTitle(line: string): SectionName | null {
  const normalized = line
    .replace(/\s+/g, '')
    .replace(/^[一二三四五六七八九十]+[、.．]?/, '')  // 去掉中文数字序号前缀
    .replace(/^\([一二三四五六七八九十]+\)/, '')       // 去掉 (一) 格式前缀
    .replace(/^（[一二三四五六七八九十]+）/, '');       // 去掉 （一） 格式前缀
  for (const title of ALL_SECTION_NAMES) {
    if (normalized.includes(title)) return title;
  }
  return null;
}

/** 根据章节名获取对应内容，找不到返回空字符串 */
export function getSection(sections: Section[], name: SectionName): string {
  const found = sections.find((s) => s.name === name);
  return found?.content ?? '';
}

/**
 * 获取一级章节及其所有子章节的合并内容
 * 用于需要整个模块文本的场景（如"信息概要"下所有子章节）
 */
export function getSectionWithChildren(sections: Section[], parentName: string): string {
  const parts: string[] = [];
  for (const s of sections) {
    if (s.name === parentName || s.parent === parentName) {
      parts.push(s.content);
    }
  }
  return parts.join('\n');
}

