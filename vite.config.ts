import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const normalizePath = (id: string) => id.replace(/\\/g, '/');

const getPackageName = (id: string) => {
  const parts = normalizePath(id).split('/node_modules/')[1]?.split('/');
  if (!parts?.length) return null;
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = normalizePath(id);
          if (!normalized.includes('/node_modules/')) return undefined;

          const packageName = getPackageName(normalized);
          if (!packageName) return 'vendor';

          if (['react', 'react-dom', 'scheduler', 'react-is'].includes(packageName)) return 'vendor-react';
          if (packageName === 'pdfjs-dist') return 'vendor-pdf';
          if (packageName === 'xlsx') return 'vendor-xlsx';
          if (packageName === 'antd') return 'vendor-antd';
          if (packageName.startsWith('@ant-design/') || packageName.startsWith('@rc-component/') || packageName.startsWith('rc-')) {
            return 'vendor-antd-support';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    host: process.env.DEV_SERVER_HOST ?? '::1',
    port: Number(process.env.VITE_DEV_SERVER_PORT ?? process.env.DEV_SERVER_PORT ?? 5175),
    strictPort: true,
  },
});
