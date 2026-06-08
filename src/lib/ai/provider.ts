import { GoogleGenAI } from '@google/genai';

export type AIProvider = 'gemini';

const DEFAULT_MODEL    = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RETRIES      = 3;
const RETRY_DELAY_MS   = 1_500; // aumenta exponencialmente

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

export interface AIResult<T> {
  data: T;
  latencyMs: number;
  model: string;
  provider: AIProvider;
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');
  return new GoogleGenAI({ apiKey });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI timeout após ${ms}ms`)), ms)
    ),
  ]);
}

/** Retorna true para erros transitórios (503 sobrecarga, 429 rate-limit) */
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 503 || status === 429) return true;
  const msg = String((err as { message?: string })?.message ?? '');
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === MAX_RETRIES - 1) throw err;
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt); // 1.5s, 3s, 6s
      console.warn(`[ai/provider] retry ${attempt + 1}/${MAX_RETRIES} em ${delay}ms —`, (err as { message?: string })?.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function generateText(options: GenerateTextOptions): Promise<AIResult<string>> {
  const model   = options.model ?? DEFAULT_MODEL;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ai      = getClient();
  const start   = Date.now();

  const config = options.systemInstruction
    ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } }
    : undefined;

  const result = await withRetry(() =>
    withTimeout(
      ai.models.generateContent({
        model,
        contents: options.prompt,
        ...(config ? { config } : {}),
      }),
      timeout
    )
  );

  return {
    data: (result.text ?? '').trim(),
    latencyMs: Date.now() - start,
    model,
    provider: 'gemini',
  };
}

export async function generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<AIResult<T>> {
  const model   = options.model ?? DEFAULT_MODEL;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ai      = getClient();
  const start   = Date.now();

  const result = await withRetry(() =>
    withTimeout(
      ai.models.generateContent({
        model,
        contents: options.prompt,
        config: { responseMimeType: 'application/json' },
      }),
      timeout
    )
  );

  const raw  = (result.text ?? '').trim();
  const data = JSON.parse(raw) as T;

  return {
    data,
    latencyMs: Date.now() - start,
    model,
    provider: 'gemini',
  };
}
