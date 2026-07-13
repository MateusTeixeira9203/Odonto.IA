import Groq from 'groq-sdk';
import { GoogleGenAI, type Schema } from '@google/genai';

export type AIProvider = 'groq' | 'gemini';

const DEFAULT_MODEL     = 'llama-3.3-70b-versatile';
// Estruturação clínica (bake-off 13/07): thinking desligado — 4,6x mais rápido, mesma precisão.
const GEMINI_STRUCT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES        = 3;
const RETRY_DELAY_MS     = 1_500;

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  timeoutMs?: number;
  feature: string;
}

export interface GenerateStructuredOptions<T = unknown> {
  prompt: string;
  model?: string;
  timeoutMs?: number;
  feature: string;
}

export interface GenerateStructuredGeminiOptions {
  prompt: string;
  /** Schema OpenAPI-subset imposto pela API (formato @google/genai). */
  responseSchema: Schema;
  feature: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
}

export interface AIResult<T> {
  data: T;
  latencyMs: number;
  model: string;
  provider: AIProvider;
}

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada');
  return new Groq({ apiKey });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI timeout após ${ms}ms`)), ms)
    ),
  ]);
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 503 || status === 429) return true;
  const msg = String((err as { message?: string })?.message ?? '');
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429') ||
    msg.includes('rate_limit') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('overloaded');
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === MAX_RETRIES - 1) throw err;
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[ai/provider] retry ${attempt + 1}/${MAX_RETRIES} em ${delay}ms —`, (err as { message?: string })?.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function generateText(options: GenerateTextOptions): Promise<AIResult<string>> {
  const model   = options.model ?? DEFAULT_MODEL;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const client  = getClient();
  const start   = Date.now();

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [];
  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  messages.push({ role: 'user', content: options.prompt });

  const result = await withRetry(() =>
    withTimeout(
      client.chat.completions.create({ model, messages }),
      timeout
    )
  );

  return {
    data: (result.choices[0]?.message?.content ?? '').trim(),
    latencyMs: Date.now() - start,
    model,
    provider: 'groq',
  };
}

export async function generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<AIResult<T>> {
  const model   = options.model ?? DEFAULT_MODEL;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const client  = getClient();
  const start   = Date.now();

  const result = await withRetry(() =>
    withTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: options.prompt }],
        response_format: { type: 'json_object' },
      }),
      timeout
    )
  );

  const raw = (result.choices[0]?.message?.content ?? '').trim();
  if (!raw) throw new Error('Groq retornou resposta vazia');

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let data: T;
  try {
    data = JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Resposta não é JSON válido: ${cleaned.slice(0, 200)}`);
  }

  return {
    data,
    latencyMs: Date.now() - start,
    model,
    provider: 'groq',
  };
}

/**
 * Estruturação via Gemini com schema imposto pela API (responseSchema) — o modelo é obrigado
 * a devolver JSON no formato exato, em qualquer tamanho de saída. Config validada no bake-off
 * de 13/07 (plans/specs/eval/): temp 0.2, thinking off, retry só em erro transitório.
 * Sem fallback de provider por decisão de spec (D5) — falhou, o chamador mostra erro e o
 * texto do usuário permanece intacto.
 */
export async function generateStructuredGemini<T>(
  options: GenerateStructuredGeminiOptions
): Promise<AIResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const client  = new GoogleGenAI({ apiKey });
  const start   = Date.now();

  const result = await withRetry(() =>
    withTimeout(
      client.models.generateContent({
        model: GEMINI_STRUCT_MODEL,
        contents: options.prompt,
        config: {
          temperature: 0.2,
          // 16384 = config exata validada no bake-off (8k mostrou tail de latência no caso pesado)
          maxOutputTokens: options.maxOutputTokens ?? 16_384,
          responseMimeType: 'application/json',
          responseSchema: options.responseSchema,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      timeout
    )
  );

  const raw = (result.text ?? '').trim();
  if (!raw) throw new Error('Gemini retornou resposta vazia');

  let data: T;
  try {
    data = JSON.parse(raw) as T;
  } catch {
    throw new Error(`Resposta não é JSON válido: ${raw.slice(0, 200)}`);
  }

  return {
    data,
    latencyMs: Date.now() - start,
    model: GEMINI_STRUCT_MODEL,
    provider: 'gemini',
  };
}
