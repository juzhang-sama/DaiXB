/** OCR 识别结果中单个文字行的位置信息 */
export interface OcrWordLocation {
  /** 左上顶点水平坐标 */
  left: number;
  /** 左上顶点垂直坐标 */
  top: number;
  /** 定位矩形宽度 */
  width: number;
  /** 定位矩形高度 */
  height: number;
}

/** OCR 识别结果中单个文字行（含位置） */
export interface OcrWord {
  words: string;
  location: OcrWordLocation;
}

/** 单页 OCR 识别结果 */
export interface OcrPageResult {
  pageIndex: number;
  wordsResult: OcrWord[];
}

