import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const port = process.env.DEV_SERVER_PORT || process.env.VITE_DEV_SERVER_PORT || '5175';
const host = process.env.DEV_SERVER_HOST || '::1';
const rendererUrl = process.env.ELECTRON_RENDERER_URL || `http://localhost:${port}`;

const children = [];

function run(command, args, env = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: isWindows,
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      shutdown(code);
    }
  });
  return child;
}

function waitForUrl(url, timeoutMs = 60000) {
  const startedAt = Date.now();
  const client = url.startsWith('https:') ? https : http;

  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = client.get(url, (res) => {
        res.resume();
        if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(3000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };

    tick();
  });
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`[dev] starting renderer at ${rendererUrl} (${host}:${port})`);
run(npmCmd, ['run', 'dev:renderer', '--', '--host', host, '--port', port, '--strictPort'], {
  VITE_DEV_SERVER_PORT: port,
});

await waitForUrl(rendererUrl);

console.log('[dev] renderer ready, starting Electron');
run(npmCmd, ['run', 'dev:main'], {
  ELECTRON_RENDERER_URL: rendererUrl,
  VITE_DEV_SERVER_PORT: port,
});
