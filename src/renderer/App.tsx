import React, { useState, useCallback, useEffect } from 'react';
import { message, Button, Layout } from 'antd';
import { DownloadOutlined, FilePdfOutlined, FileTextOutlined, AppstoreOutlined, SettingOutlined } from '@ant-design/icons';
import PdfViewer from './components/PdfViewer';
import CreditReportTabs from './components/CreditReportTabs';
import ProductDrawer from './components/ProductDrawer';
import SetupModal from './components/SetupModal';
import { CreditReport, createEmptyCreditReport } from './types/credit-report';
import { analyzeCreditReport } from './services/ocr-service';
import { logError } from './utils/debug-log';

const { Header, Content } = Layout;

const App: React.FC = () => {
  const electronAvailable = typeof window.electron !== 'undefined';
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [report, setReport] = useState<CreditReport>(createEmptyCreditReport());
  const [analyzing, setAnalyzing] = useState(false);
  const [activeView, setActiveView] = useState<'pdf' | 'report'>('pdf');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [keysReady, setKeysReady] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      exportCreditReportToExcel(report, fileName);
      message.success('导出成功');
    } catch (err) {
      logError('[exportCreditReportToExcel] error:', err);
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  }, [exporting, report]);

  const handleFileChange = useCallback(async (file: File | null) => {
    setPdfFile(file);
    if (!file) return;
    if (!electronAvailable) {
      message.warning('请在 Electron 应用窗口中使用 OCR 解析功能');
      return;
    }

    setAnalyzing(true);
    setActiveView('report');

    try {
      const result = await analyzeCreditReport(file);
      setReport(result.report);
      message.success('解析完成');
    } catch (err) {
      logError('[analyzeCreditReport] error:', err);
      message.error('解析失败，请手动填写');
    } finally {
      setAnalyzing(false);
    }
  }, [electronAvailable]);

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
            disabled={!pdfFile && !report.header}
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
            icon={<AppstoreOutlined />}
            onClick={() => setDrawerOpen(true)}
          >
            产品库
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
            file={pdfFile}
            onFileChange={handleFileChange}
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
            <CreditReportTabs report={report} loading={analyzing} onChange={setReport} />
          </div>
        </div>
      </Content>

      <ProductDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} report={report} />
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
