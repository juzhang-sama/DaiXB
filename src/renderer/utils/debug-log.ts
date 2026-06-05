const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };

export const DEBUG_ENABLED =
  meta.env?.VITE_DEBUG_LOGS === 'true' ||
  meta.env?.DEBUG_LOGS === 'true';

export function debugLog(...args: unknown[]): void {
  if (DEBUG_ENABLED) console.log(...args);
}

export function debugWarn(...args: unknown[]): void {
  if (DEBUG_ENABLED) console.warn(...args);
}

export function logError(...args: unknown[]): void {
  console.error(...args);
}
