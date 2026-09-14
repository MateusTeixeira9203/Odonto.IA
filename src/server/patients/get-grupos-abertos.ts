import { createClient } from '@/lib/supabase/server';
import { agregarGruposAbertos, type GrupoAberto, type EventoGrupoAbertoRow } from '@/lib/odontograma/grupos-abertos';

export type { GrupoAberto };

/**
 * R-02 Fase 3 — alicerce de "grupo_id sobrevive entre consultas" (spec R-02, Decisão 1 =
 * Opção A / Decisão 2 = "só a query, sem UI de confirmação", 23/07). Devolve os grupos de
 * trabalho ainda abertos (algum evento `indicado`) de um paciente, cruzando TODAS as
 * fichas dele — não só a consulta aberta agora. Leitura pura, sem RPC: a RLS de select já
 * é aberta pra clínica inteira (migration 099/101).
 *
 * ESCOPO DESTA FASE — deliberadamente só a leitura, sem chamador ainda no app. O
 * reaproveitamento automático de grupo_id na criação (ToothDetailPanel: "abrir um dente
 * com grupo aberto do mesmo tipo reusa o grupo_id existente") fica FORA. A spec resolveu
 * "sem UI de confirmação AGORA" — não "liga automático e silencioso". Amarrar errado sem
 * perguntar cria um "trabalho fantasma" que mistura dois procedimentos (risco que a
 * própria spec registrou, §Decisão 2); a tela que tornaria isso seguro é do cockpit
 * (R-15), fora desta spec. Função pronta e testada (agregarGruposAbertos, 8 casos); o
 * wiring na escrita entra quando o R-15 trouxer a confirmação.
 */
export async function buscarGruposAbertos({
  patientId, clinicId,
}: { patientId: string; clinicId: string }): Promise<GrupoAberto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('odontograma_eventos')
    .select('grupo_id, tipo, dente, status, registrado_em')
    .eq('paciente_id', patientId)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .not('grupo_id', 'is', null);

  if (error || !data) return [];
  return agregarGruposAbertos(data as unknown as EventoGrupoAbertoRow[]);
}
