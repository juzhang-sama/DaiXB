import assert from 'node:assert/strict';
import type { DocParserResult } from '../../../shared/doc-parser-types';
import { mergeDocParserResults } from '../doc-parser-merge';

function makeDoc(fileName: string, fileId: string, pageId: string, layoutId: string): DocParserResult {
  return {
    file_name: fileName,
    file_id: fileId,
    pages: [{
      page_id: pageId,
      page_num: 0,
      text: fileName,
      layouts: [{
        layout_id: layoutId,
        text: fileName,
        position: [0, 0, 100, 20],
        type: 'table',
        sub_type: '',
        parent: '',
        children: ['cell-1'],
      }],
      tables: [{
        layout_id: layoutId,
        markdown: '| 字段 | 值 |\n| --- | --- |\n| 报告编号 | 1 |',
        position: [0, 0, 100, 20],
        cells: [{
          layout_id: 'cell-1',
          text: '报告编号',
          position: [0, 0, 20, 20],
          type: 'text',
          sub_type: '',
        }],
        matrix: [[0]],
        merge_table: '',
      }],
      images: [],
      meta: {
        page_width: 800,
        page_height: 1200,
        is_scan: true,
        page_angle: 0,
        page_type: 'image',
      },
    }],
  };
}

const merged = mergeDocParserResults([
  makeDoc('page1.png', 'file-a', 'page', 'layout-table'),
  makeDoc('page2.png', 'file-b', 'page', 'layout-table'),
], 'multi-image');

assert.equal(merged.file_name, 'multi-image');
assert.equal(merged.pages.length, 2);
assert.deepEqual(merged.pages.map((page) => page.page_num), [0, 1]);
assert.equal(merged.pages[0].page_id, 'img1:page');
assert.equal(merged.pages[1].page_id, 'img2:page');
assert.equal(merged.pages[0].layouts[0].layout_id, 'img1:layout-table');
assert.equal(merged.pages[0].tables[0].layout_id, 'img1:layout-table');
assert.equal(merged.pages[1].tables[0].cells[0].layout_id, 'img2:cell-1');
