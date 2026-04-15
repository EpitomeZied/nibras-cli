// ============================================================
// OpenAI-compatible API client
// Compatible with: OpenAI, Azure, Ollama, any OpenAI-compatible provider
// ============================================================

import { GradingConfig } from './types';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  text: string;
  rawJson?: unknown;
}

export async function chatCompletion(
  messages: Message[],
  config: GradingConfig,
  jsonMode = true
): Promise<ChatResponse> {
  const baseURL = config.baseURL ?? 'https://api.openai.com/v1';
  const model = config.model ?? 'gpt-4o-mini';
  const maxRetries = config.maxRetries ?? 2;
  const { timeoutMs } = config;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0, // نريد نتيجة deterministic للتصحيح
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s, …
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }

    const controller = timeoutMs ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

    try {
      const res = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });

      // Retryable: rate-limit or server error
      if (res.status === 429 || res.status >= 500) {
        const err = await res.text();
        lastError = new Error(`AI API error ${res.status}: ${err}`);
        continue;
      }

      // Non-retryable: bad request (400, 401, 403, …)
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`AI API error ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const text = data.choices[0]?.message?.content ?? '';

      let rawJson: unknown;
      if (jsonMode) {
        try {
          rawJson = JSON.parse(text);
        } catch {
          throw new Error(`AI returned invalid JSON: ${text}`);
        }
      }

      return { text, rawJson };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`AI API timeout after ${timeoutMs}ms`);
        continue; // timeout is retryable
      }
      throw err; // re-throw non-retryable errors immediately
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  throw lastError ?? new Error('AI API failed after retries');
}

// Helper: بيقسم array لـ batches عشان ما نعدّيش الـ context window
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
