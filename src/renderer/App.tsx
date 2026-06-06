import React, { useState, useCallback, useEffect, useRef } from 'react';
import { message, Button, Layout } from 'antd';
import { DownloadOutlined, FilePdfOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons';
import PdfViewer from './components/PdfViewer';
import CreditReportTabs from './components/CreditReportTabs';
import SetupModal from './components/SetupModal';
import { CreditReport, createEmptyCreditReport } from './types/credit-report';
import { analyzeCreditReportFiles } from './services/ocr-service';
import { isImageFile } from './config/ocr-config';
import { logError } from './utils/debug-log';
import type { OcrQualityReport } from './parser/ocr-quality';
import type { OcrDiagnosticsReport, OcrReviewState } from './types/ocr-diagnostics';

const { Header, Content } = Layout;

const App: React.FC = () => {
  const electronAvailable = typeof window.electron !== 'undefined';
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [report, setReport] = useState<CreditReport>(createEmptyCreditReport());
  const [quality, setQuality] = useState<OcrQualityReport | undefined>();
  const [diagnostics, setDiagnostics] = useState<OcrDiagnosticsReport | undefined>();
  const [reviewState, setReviewState] = useState<OcrReviewState>({ reviewedIssueIds: [] });
  const [analyzing, setAnalyzing] = useState(false);
  const [activeView, setActiveView] = useState<'pdf' | 'report'>('pdf');
  const [setupOpen, setSetupOpen] = useState(false);
  const [keysReady, setKeysReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const analyzeSeqRef = useRef(0);

  useEffect(() => {
    if (!electronAvailable) return;
    window.electron.hasApiKeys().then((has) => {
      if (!has) {
        setSetupOpen(true);
      } else {
        setKeysReady(true);
      }
    });
  }, [electronAvailable]);

  const handleExport = useCallback(async () => {
    if (!report.header.reportNo) {
      message.warning('暂无数据可导出');
      return;
    }
    if (exporting) return;

    const fileName = `${report.header.name || '未命名'}_征信报告_${report.header.reportNo || '未知编号'}.xlsx`;
    setExporting(true);
    try {
      const { exportCreditReportToExcel } = await import('./services/excel-export');
      exportCreditReportToExcel(report, fileName, reviewState, diagnostics);
      message.success('导出成功');
    } catch (err) {
      logError('[exportCreditReportToExcel] error:', err);
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  }, [diagnostics, exporting, report, reviewState]);

  const handleFilesChange = useCallback(async (files: File[], preferredPage = 1) => {
    const nextFiles = files.filter(Boolean);
    if (nextFiles.length > 1 && !nextFiles.every(isImageFile)) {
      message.warning('多文件上传仅支持图片。PDF 请单独上传，图片可多张组成一套征信报告。');
      return;
    }

    const seq = analyzeSeqRef.current + 1;
    analyzeSeqRef.current = seq;
    setDocumentFiles(nextFiles);
    setCurrentPage(Math.max(1, Math.min(preferredPage, nextFiles.length || 1)));
    setReviewState({ reviewedIssueIds: [] });

    if (nextFiles.length === 0) {
      setQuality(undefined);
      setDiagnostics(undefined);
      setAnalyzing(false);
      return;
    }
    if (!electronAvailable) {
      message.warning('请在 Electron 应用窗口中使用 OCR 解析功能');
      return;
    }

    setAnalyzing(true);
    setActiveView('report');

    try {
      const result = await analyzeCreditReportFiles(nextFiles);
      if (seq !== analyzeSeqRef.current) return;
      setReport(result.report);
      setQuality(result.quality);
      setDiagnostics(result.diagnostics);
      if (result.quality?.issues.length) {
        message.warning(`解析完成，存在 ${result.quality.issues.length} 项质量提示`);
      } else {
        message.success(nextFiles.length > 1 ? `已合并解析 ${nextFiles.length} 张图片` : '解析完成');
      }
    } catch (err) {
      if (seq !== analyzeSeqRef.current) return;
      logError('[analyzeCreditReportFiles] error:', err);
      message.error('解析失败，请核对文件后重试或手动填写');
    } finally {
      if (seq === analyzeSeqRef.current) {
        setAnalyzing(false);
      }
    }
  }, [electronAvailable]);

  const handleReportChange = useCallback((nextReport: CreditReport) => {
    setReport(nextReport);
    setReviewState({ reviewedIssueIds: [] });
  }, []);

  const handleReviewIssues = useCallback((issueIds: string[]) => {
    if (issueIds.length === 0) return;
    setReviewState((prev) => {
      const merged = new Set(prev.reviewedIssueIds);
      issueIds.forEach((issueId) => merged.add(issueId));
      return {
        reviewedIssueIds: Array.from(merged),
        reviewedAt: new Date().toISOString(),
      };
    });
    message.success(issueIds.length === 1 ? '已标记为人工复核' : `已标记 ${issueIds.length} 项为人工复核`);
  }, []);

  const handleClearReview = useCallback(() => {
    setReviewState({ reviewedIssueIds: [] });
    message.info('已清除人工复核状态');
  }, []);

  return (
    <Layout className="h-screen bg-gray-50">
      <Header className="bg-blue-600 border-b border-blue-700 px-4 flex items-center justify-between h-14">
        <div className="text-lg font-bold text-white">天才群策——征信贷小帮</div>
        <div className="flex gap-2">
          <Button
            type={activeView === 'pdf' ? 'primary' : 'default'}
            icon={<FilePdfOutlined />}
            onClick={() => setActiveView('pdf')}
          >
            PDF 预览
          </Button>
          <Button
            type={activeView === 'report' ? 'primary' : 'default'}
            icon={<FileTextOutlined />}
            onClick={() => setActiveView('report')}
            disabled={documentFiles.length === 0 && !report.header.reportNo}
          >
            结构化数据
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={!report.header.reportNo || exporting}
            loading={exporting}
          >
            导出 Excel
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setSetupOpen(true)}
            disabled={!electronAvailable}
          >
            设置
          </Button>
        </div>
      </Header>

      <Content className="h-[calc(100vh-56px)] overflow-hidden relative">
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            activeView === 'pdf' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <PdfViewer
            files={documentFiles}
            onFilesChange={handleFilesChange}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>

        <div
          className={`absolute inset-0 bg-gray-50 overflow-auto transition-opacity duration-300 ${
            activeView === 'report' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <CreditReportTabs
              report={report}
              quality={quality}
              diagnostics={diagnostics}
              reviewState={reviewState}
              loading={analyzing}
              onChange={handleReportChange}
              onReviewIssues={handleReviewIssues}
              onClearReview={handleClearReview}
            />
          </div>
        </div>
      </Content>

      {electronAvailable && (
        <SetupModal
          open={setupOpen}
          onSuccess={() => { setSetupOpen(false); setKeysReady(true); }}
        />
      )}
    </Layout>
  );
};

export default App;
