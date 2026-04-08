// ============================================================
// OpenAI-compatible API client
// Compatible with: OpenAI, Azure, Ollama, any OpenAI-compatible provider
// ============================================================

import { GradingConfig } from "./types.js";

interface Message {
  role: "system" | "user" | "assistant";
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
  const baseURL = config.baseURL ?? "https://api.openai.com/v1";
  const model = config.model ?? "gpt-4o-mini";

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0, // نريد نتيجة deterministic للتصحيح
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const text = data.choices[0]?.message?.content ?? "";

  let rawJson: unknown;
  if (jsonMode) {
    try {
      rawJson = JSON.parse(text);
    } catch {
      throw new Error(`AI returned invalid JSON: ${text}`);
    }
  }

  return { text, rawJson };
}

// Helper: بيقسم array لـ batches عشان ما نعدّيش الـ context window
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
