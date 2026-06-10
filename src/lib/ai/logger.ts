import { createServiceClient } from '@/lib/supabase/service';

export interface AILogEntry {
  feature: string;
  provider: 'gemini' | 'groq';
  model: string;
  latencyMs: number;
  success: boolean;
  dentistaId?: string;
  clinicaId?: string;
  pacienteId?: string;
  error?: string;
}

export function logAICall(entry: AILogEntry): void {
  const level = entry.success ? 'log' : 'error';
  console[level]('[ai]', JSON.stringify({ ...entry, ts: new Date().toISOString() }));
  persistLog(entry).catch(() => {}); // fire-and-forget, never throws
}

async function persistLog(entry: AILogEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('ai_usage_logs').insert({
      feature:     entry.feature,
      provider:    entry.provider,
      model:       entry.model,
      latency_ms:  entry.latencyMs,
      success:     entry.success,
      dentista_id: entry.dentistaId ?? null,
      clinica_id:  entry.clinicaId ?? null,
      paciente_id: entry.pacienteId ?? null,
      error:       entry.error ?? null,
    });
  } catch {
    // Logging must never break the app
  }
}
