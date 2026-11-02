import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarNome } from '@/lib/normalizar-nome';

export interface CandidatoDuplicata {
  id: string;
  nome: string;
  data_nascimento: string | null;
  telefone: string | null;
  /** Existe histórico clínico — o aviso muda de tom quando há prontuário em jogo. */
  tem_ficha: boolean;
  motivo: 'cpf' | 'nome_exato' | 'nome_e_telefone' | 'nome_e_nascimento';
}

const soDigitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

/**
 * R-31a §3.1 — checagem única de duplicata, usada por `createPaciente` e
 * `criarPacienteRapido`. Nunca lança, nunca bloqueia — devolve o que achou, e quem chama
 * decide se avisa. Compara por `nome_busca` (mesma normalização de `normalizar_nome`,
 * migration 125) pra "Marcia" e "Márcia" contarem como o mesmo nome.
 */
export async function buscarPossiveisDuplicatas(
  supabase: SupabaseClient,
  clinicaId: string,
  dados: { nome: string; cpf?: string | null; telefone?: string | null; dataNascimento?: string | null },
): Promise<CandidatoDuplicata[]> {
  const nomeBusca = normalizarNome(dados.nome);
  if (!nomeBusca) return [];

  const cpfRaw = dados.cpf?.trim() || null;
  const cpfDigits = soDigitos(dados.cpf) || null;
  const telefoneDigits = soDigitos(dados.telefone) || null;

  type Raw = {
    id: string; nome: string; data_nascimento: string | null;
    telefone: string | null; cpf: string | null; fichas: { id: string }[] | null;
  };

  const select = 'id, nome, data_nascimento, telefone, cpf, fichas!fichas_paciente_id_fkey(id)';

  // Duas queries simples em vez de um `.or()` entre colunas diferentes — `cpf` pode
  // conter ponto e traço ("111.222.333-44"), e interpolar isso numa string de filtro do
  // PostgREST é frágil. `.in()` deixa o client escapar o valor, não uma string montada à mão.
  const cpfCandidatos = cpfRaw && cpfRaw !== cpfDigits ? [cpfDigits, cpfRaw] : [cpfDigits];
  const [porNome, porCpf] = await Promise.all([
    supabase.from('pacientes').select(select)
      .eq('clinica_id', clinicaId).eq('nome_busca', nomeBusca).limit(10),
    cpfDigits
      ? supabase.from('pacientes').select(select)
          .eq('clinica_id', clinicaId).in('cpf', cpfCandidatos).limit(5)
      : Promise.resolve({ data: [] as Raw[], error: null }),
  ]);

  if (porNome.error) return [];

  const porId = new Map<string, Raw>();
  for (const p of (porNome.data ?? []) as unknown as Raw[]) porId.set(p.id, p);
  if (!porCpf.error) for (const p of (porCpf.data ?? []) as unknown as Raw[]) porId.set(p.id, p);

  return Array.from(porId.values()).map((p) => {
    const cpfBate = !!cpfDigits && soDigitos(p.cpf) === cpfDigits;
    const telefoneBate = !!telefoneDigits && soDigitos(p.telefone) === telefoneDigits;
    const nascimentoBate = !!dados.dataNascimento && !!p.data_nascimento && p.data_nascimento === dados.dataNascimento;

    const motivo: CandidatoDuplicata['motivo'] = cpfBate
      ? 'cpf'
      : telefoneBate
        ? 'nome_e_telefone'
        : nascimentoBate
          ? 'nome_e_nascimento'
          : 'nome_exato';

    return {
      id: p.id,
      nome: p.nome,
      data_nascimento: p.data_nascimento,
      telefone: p.telefone,
      tem_ficha: (p.fichas?.length ?? 0) > 0,
      motivo,
    };
  });
}
