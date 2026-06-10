import Groq from 'groq-sdk';

export type AIProvider = 'groq';

const DEFAULT_MODEL     = 'llama-3.3-70b-versatile';
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
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429') || msg.includes('rate_limit');
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
