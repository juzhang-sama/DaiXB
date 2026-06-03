/**
 * DeepSeek API 客户端 — Electron 主进程调用
 *
 * 职责：发送 chat completion 请求，返回文本结果
 * API Key 存在主进程，不暴露给渲染进程
 */

import { DEEPSEEK_CONFIG } from './deepseek-config';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekChoice {
  message: { role: string; content: string };
  finish_reason: string;
}

interface DeepSeekResponse {
  id: string;
  choices: DeepSeekChoice[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** 调用 DeepSeek Chat Completion API */
export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const url = `${DEEPSEEK_CONFIG.baseUrl}/chat/completions`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_CONFIG.model,
      messages,
      max_tokens: DEEPSEEK_CONFIG.maxTokens,
      temperature: DEEPSEEK_CONFIG.temperature,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`deepseek api error: ${resp.status} ${body}`);
  }

  const data = (await resp.json()) as DeepSeekResponse;

  if (!data.choices?.length) {
    throw new Error('deepseek api returned empty choices');
  }

  return data.choices[0].message.content;
}

