const DEBUG_ENABLED = process.env.DEBUG_LOGS === 'true' || process.env.ELECTRON_DEBUG_LOGS === 'true';

export function debugLog(...args: unknown[]): void {
  if (DEBUG_ENABLED) console.log(...args);
}

export function debugWarn(...args: unknown[]): void {
  if (DEBUG_ENABLED) console.warn(...args);
}

export function logError(...args: unknown[]): void {
  console.error(...args);
}
