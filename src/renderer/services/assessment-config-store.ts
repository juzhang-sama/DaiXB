import { DEFAULT_CONFIG, type AssessmentConfig } from './assessment-config-default';

const STORAGE_KEY = 'credit-assessment-config';

export function getAssessmentConfig(): AssessmentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return JSON.parse(raw, infinityReviver) as AssessmentConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAssessmentConfig(config: AssessmentConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config, infinityReplacer, 2));
}

export function resetAssessmentConfig(): AssessmentConfig {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_CONFIG;
}

export function configToJson(config: AssessmentConfig): string {
  return JSON.stringify(config, infinityReplacer, 2);
}

export function parseConfigJson(json: string): AssessmentConfig {
  return JSON.parse(json, infinityReviver) as AssessmentConfig;
}

function infinityReplacer(_key: string, value: unknown): unknown {
  return value === Infinity ? 'Infinity' : value;
}

function infinityReviver(_key: string, value: unknown): unknown {
  return value === 'Infinity' ? Infinity : value;
}
