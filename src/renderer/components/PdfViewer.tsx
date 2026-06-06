import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Space, Spin, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import {
  DeleteOutlined,
  DownOutlined,
  FileImageOutlined,
  InboxOutlined,
  LeftOutlined,
  RightOutlined,
  UpOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import * as pdfjsLib from 'pdfjs-dist';
import { isImageFile, UPLOAD_ACCEPT } from '../config/ocr-config';
import { logError } from '../utils/debug-log';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  files: File[];
  onFilesChange: (files: File[], preferredPage?: number) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;

const PdfViewer: React.FC<PdfViewerProps> = ({
  files,
  onFilesChange,
  currentPage,
  onPageChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTask = useRef<any>(null);
  const uploadTimer = useRef<number | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pageRendering, setPageRendering] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const firstFile = files[0] ?? null;
  const isImageSet = files.length > 0 && files.every(isImageFile);
  const isPdfMode = files.length === 1 && Boolean(firstFile) && !isImageSet;
  const currentImageUrl = isImageSet ? imageUrls[currentPage - 1] : null;
  const currentFileName = isImageSet
    ? files[currentPage - 1]?.name ?? files[0]?.name
    : firstFile?.name;

  const scheduleUpload: UploadProps['beforeUpload'] = (_file, fileList) => {
    const selectedFiles = fileList.map((item) => item as File);
    if (uploadTimer.current) {
      window.clearTimeout(uploadTimer.current);
    }
    uploadTimer.current = window.setTimeout(() => {
      onFilesChange(selectedFiles);
      uploadTimer.current = null;
    }, 0);
    return false;
  };

  useEffect(() => () => {
    if (uploadTimer.current) {
      window.clearTimeout(uploadTimer.current);
    }
  }, []);

  useEffect(() => {
    if (!isImageSet) {
      setImageUrls([]);
      return;
    }

    const urls = files.map((file) => URL.createObjectURL(file));
    setPdfDoc(null);
    setTotalPages(files.length);
    setScale(1);
    setImageUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files, isImageSet]);

  useEffect(() => {
    if (!isPdfMode || !firstFile) {
      if (!isPdfMode) setPdfDoc(null);
      return;
    }

    let canceled = false;
    setImageUrls([]);
    setPageRendering(true);

    const loadDoc = async () => {
      try {
        const arrayBuffer = await firstFile.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        if (canceled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setScale(1);
        onPageChange(1);
      } catch (err) {
        if (!canceled) {
          logError('Error loading PDF:', err);
        }
      } finally {
        if (!canceled) {
          setPageRendering(false);
        }
      }
    };

    loadDoc();
    return () => {
      canceled = true;
    };
  }, [firstFile, isPdfMode, onPageChange]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      onPageChange(totalPages);
    }
  }, [currentPage, onPageChange, totalPages]);

  const fitToWidth = useCallback(async () => {
    if (isImageSet) {
      setScale(1);
      return;
    }
    if (!pdfDoc || !containerRef.current) return;
    try {
      const page = await pdfDoc.getPage(currentPage);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const containerWidth = containerRef.current.clientWidth - 80;
      if (containerWidth > 0 && unscaledViewport.width > 0) {
        setScale(Math.max(MIN_SCALE, Math.min(containerWidth / unscaledViewport.width, MAX_SCALE)));
      }
    } catch (err) {
      logError('fitToWidth error:', err);
    }
  }, [currentPage, isImageSet, pdfDoc]);

  useEffect(() => {
    if (pdfDoc) {
      fitToWidth();
    }
  }, [fitToWidth, pdfDoc]);

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

        const task = page.render({ canvasContext: context, viewport, canvas });
        renderTask.current = task;
        await task.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          logError('Error rendering page:', err);
        }
      } finally {
        setPageRendering(false);
      }
    };

    render();
  }, [currentPage, pdfDoc, scale]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + SCALE_STEP, MAX_SCALE));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - SCALE_STEP, MIN_SCALE));
  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };
  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const nextFiles = [...files];
    const [item] = nextFiles.splice(index, 1);
    nextFiles.splice(target, 0, item);
    onFilesChange(nextFiles, target + 1);
  };

  const removeImage = (index: number) => {
    const nextFiles = files.filter((_, fileIndex) => fileIndex !== index);
    const nextPage = Math.max(1, Math.min(currentPage, nextFiles.length));
    onFilesChange(nextFiles, nextPage);
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
        <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-lg m-8 hover:border-blue-500 transition-colors bg-gray-50">
          <Upload.Dragger
            accept={UPLOAD_ACCEPT}
            multiple
            showUploadList={false}
            beforeUpload={scheduleUpload}
            className="w-full h-full"
            style={{ background: 'transparent', border: 'none' }}
          >
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-6xl text-blue-400 mb-8"><InboxOutlined /></p>
              <p className="text-xl font-medium text-gray-700 mb-2">点击或拖拽上传征信报告</p>
              <p className="text-sm text-gray-500">支持单个 PDF，或一次选择多张图片组成同一份征信报告</p>
            </div>
          </Upload.Dragger>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm z-10">
        <Typography.Text className="text-sm font-medium text-gray-700 truncate max-w-sm" title={currentFileName}>
          {isImageSet && files.length > 1 ? `${files.length} 张图片 · ${currentFileName}` : currentFileName}
        </Typography.Text>
        <Space size="middle">
          <Button type="text" onClick={fitToWidth}>适应宽度</Button>
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
        <Upload accept={UPLOAD_ACCEPT} multiple showUploadList={false} beforeUpload={scheduleUpload}>
          <Button type="primary" ghost>重新上传</Button>
        </Upload>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {isImageSet && files.length > 1 && (
          <aside className="w-72 flex-none overflow-auto border-r border-gray-200 bg-white">
            <div className="px-4 py-3 border-b border-gray-100">
              <Typography.Text strong>图片页序</Typography.Text>
              <div className="text-xs text-gray-500 mt-1">OCR 将按此顺序合并解析</div>
            </div>
            <div className="p-2 space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className={`flex items-center gap-2 rounded-md border px-2 py-2 ${
                    currentPage === index + 1 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <Button
                    size="small"
                    type={currentPage === index + 1 ? 'primary' : 'text'}
                    icon={<FileImageOutlined />}
                    onClick={() => onPageChange(index + 1)}
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onPageChange(index + 1)}
                    title={file.name}
                  >
                    <div className="text-xs text-gray-500">第 {index + 1} 页</div>
                    <div className="truncate text-sm text-gray-800">{file.name}</div>
                  </button>
                  <Space size={2}>
                    <Button size="small" icon={<UpOutlined />} disabled={index === 0} onClick={() => moveImage(index, -1)} />
                    <Button size="small" icon={<DownOutlined />} disabled={index === files.length - 1} onClick={() => moveImage(index, 1)} />
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeImage(index)} />
                  </Space>
                </div>
              ))}
            </div>
          </aside>
        )}

        <div ref={containerRef} className="flex-1 overflow-auto flex justify-center bg-gray-100 p-8 scroll-smooth">
          <div className="shadow-lg min-h-[500px] flex items-start justify-center bg-white relative">
            {pageRendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <Spin description="正在渲染..." size="large" />
              </div>
            )}
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt={currentFileName}
                style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
                className="max-w-full"
              />
            ) : (
              <canvas ref={canvasRef} className={pageRendering ? 'invisible' : 'visible'} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;
