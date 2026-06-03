import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Button, Space, Typography, Upload, Spin } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  LeftOutlined,
  RightOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import * as pdfjsLib from 'pdfjs-dist';
import { isImageFile, UPLOAD_ACCEPT } from '../config/ocr-config';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface PdfViewerProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;

const PdfViewer: React.FC<PdfViewerProps> = ({
  file,
  onFileChange,
  currentPage,
  onPageChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTask = useRef<any>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pageRendering, setPageRendering] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const isImage = file ? isImageFile(file) : false;

  // 自动适应宽度
  const fitToWidth = useCallback(async () => {
    if (!pdfDoc || !containerRef.current) return;
    try {
      const page = await pdfDoc.getPage(currentPage);
      // 获取原始尺寸 viewport (scale=1)
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const containerWidth = containerRef.current.clientWidth - 80; // 减去 padding (p-8 = 32px * 2 = 64px, + margin)
      if (containerWidth > 0 && unscaledViewport.width > 0) {
        const newScale = containerWidth / unscaledViewport.width;
        setScale(newScale);
      }
    } catch (err) {
      console.error('fitToWidth error:', err);
    }
  }, [pdfDoc, currentPage]);

  // 加载文件（PDF 或图片）
  useEffect(() => {
    if (!file) return;

    // 清理旧的图片 URL
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }

    if (isImageFile(file)) {
      // 图片：生成预览 URL，无需 pdfjs
      setPdfDoc(null);
      setTotalPages(1);
      setImageUrl(URL.createObjectURL(file));
      onPageChange(1);
      return;
    }

    // PDF：走 pdfjs 加载
    const loadDoc = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        onPageChange(1);
      } catch (err) {
        console.error('Error loading PDF:', err);
      }
    };

    loadDoc();

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [file]);

  // 当 pdfDoc 变化或 currentPage 变化时，如果这是新加载的文件，尝试适应宽度
  // 但我们只想在文件刚加载时适应宽度，或者用户点击"适应宽度"按钮时。
  // 为了简单，我们可以在 pdfDoc 变更后(即文件加载后)触发一次 fitToWidth。
  useEffect(() => {
    if (pdfDoc) {
      fitToWidth();
    }
  }, [pdfDoc, fitToWidth]);

  // 渲染页面
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const render = async () => {
      if (renderTask.current) {
        renderTask.current.cancel();
      }
      setPageRendering(true);

      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTask.current = task;
        await task.promise;
      } catch (err: any) {
        if (err.name === 'RenderingCancelledException') {
          return;
        }
        console.error('Error rendering page:', err);
      } finally {
        setPageRendering(false);
      }
    };

    render();
  }, [pdfDoc, currentPage, scale]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));
  const handleFitWidth = () => fitToWidth();

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };


  const handleUpload = (uploadFile: File) => {
    onFileChange(uploadFile);
    return false;
  };

  if (!file) {
    return (
      <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
      <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-lg m-8 hover:border-blue-500 transition-colors bg-gray-50">
        <Upload.Dragger
          accept={UPLOAD_ACCEPT}
          showUploadList={false}
          beforeUpload={handleUpload}
          className="w-full h-full"
          style={{ background: 'transparent', border: 'none' }}
        >
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-6xl text-blue-400 mb-8"><InboxOutlined /></p>
            <p className="text-xl font-medium text-gray-700 mb-2">点击或拖拽上传征信报告</p>
            <p className="text-sm text-gray-500">支持 PDF（电子版/扫描版）及图片（JPG、PNG、BMP、TIFF）</p>
          </div>
        </Upload.Dragger>
      </div>
    </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 工具栏 - 吸顶 */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm z-10">
        <Typography.Text className="text-sm font-medium text-gray-700 truncate max-w-xs" title={file.name}>
          {file.name}
        </Typography.Text>
        <Space size="middle">
          <Button type="text" onClick={handleFitWidth}>适应宽度</Button>
          <Space size="small">
            <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
            <span className="text-sm w-12 text-center inline-block">{Math.round(scale * 100)}%</span>
            <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
          </Space>
          <Space size="small">
            <Button icon={<LeftOutlined />} onClick={handlePrev} disabled={currentPage <= 1} />
            <span className="text-sm">第 {currentPage} 页 / 共 {totalPages} 页</span>
            <Button icon={<RightOutlined />} onClick={handleNext} disabled={currentPage >= totalPages} />
          </Space>
        </Space>
        <Upload accept={UPLOAD_ACCEPT} showUploadList={false} beforeUpload={handleUpload}>
          <Button type="primary" ghost>重新上传</Button>
        </Upload>
      </div>

      {/* 画布区 - 滚动 */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center bg-gray-100 p-8 scroll-smooth">
        <div className="shadow-lg min-h-[500px] flex items-center justify-center bg-white relative">
          {pageRendering && (
             <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
               <Spin tip="正在渲染..." size="large" />
             </div>
          )}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={file.name}
              style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
              className="max-w-full"
            />
          ) : (
            <canvas ref={canvasRef} className={pageRendering ? 'invisible' : 'visible'} />
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;

