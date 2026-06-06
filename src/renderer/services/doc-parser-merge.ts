import type { DocParserResult } from '../../shared/doc-parser-types';

export function mergeDocParserResults(results: DocParserResult[], fileName: string): DocParserResult {
  const pages: DocParserResult['pages'] = [];

  results.forEach((result, resultIndex) => {
    const prefix = `img${resultIndex + 1}`;
    for (const page of result.pages) {
      const id = (value: string) => (value ? `${prefix}:${value}` : value);
      pages.push({
        ...page,
        page_id: id(page.page_id) || `${prefix}:page-${pages.length + 1}`,
        page_num: pages.length,
        layouts: page.layouts.map((layout) => ({
          ...layout,
          layout_id: id(layout.layout_id),
          parent: id(layout.parent),
          children: (layout.children ?? []).map(id),
        })),
        tables: page.tables.map((table) => ({
          ...table,
          layout_id: id(table.layout_id),
          cells: (table.cells ?? []).map((cell) => ({
            ...cell,
            layout_id: id(cell.layout_id),
          })),
        })),
      });
    }
  });

  return {
    file_name: fileName,
    file_id: `multi-image:${results.map((result) => result.file_id || result.file_name).join('|')}`,
    pages,
  };
}
