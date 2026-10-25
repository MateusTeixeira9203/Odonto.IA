import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import { MOTIVOS_EXCLUSAO, mensagemErroExclusao, nomeConfere, podeApagar, recuperarConfirmacaoOrcamento, type ConfirmacaoExclusaoFicha } from './exclusao-ficha';
import type { DeletarFichaResult, PrepararExclusaoFichaResult } from '../../server/patients/salvar-ficha';
import type { RegistrarAtendimentoClinicoInput, RegistrarAtendimentoClinicoResult } from '../../server/patients/registrar-atendimento-clinico';

test('nome confere com espaços e caixa, preservando acentos e ordem', () => {
  assert.equal(nomeConfere('  PACIENTE   Sintético  ', 'Paciente Sintético'), true);
  assert.equal(nomeConfere('Paciente Sintetico', 'Paciente Sintético'), false);
  assert.equal(nomeConfere('Sintético Paciente', 'Paciente Sintético'), false);
});

test('botão exige motivo, nome e detalhe de Outro dentro dos limites do banco', () => {
  const base = { motivo: 'paciente_errado', nomeConfere: true, orcamentosMantidos: 0, caixaMarcada: false };
  for (const motivo of MOTIVOS_EXCLUSAO) {
    assert.equal(podeApagar({ ...base, motivo: motivo.valor, detalhe: 'Teste' }), true);
  }
  assert.equal(podeApagar({ ...base, motivo: '' }), false);
  assert.equal(podeApagar({ ...base, motivo: 'invalido' }), false);
  assert.equal(podeApagar({ ...base, nomeConfere: false }), false);
  for (const detalhe of ['', '    ', '1234', 'a'.repeat(201)]) {
    assert.equal(podeApagar({ ...base, motivo: 'outro', detalhe }), false);
  }
  for (const detalhe of [' 12345 ', 'a'.repeat(200), '😀'.repeat(200)]) {
    assert.equal(podeApagar({ ...base, motivo: 'outro', detalhe }), true);
  }
});

test('checkbox é obrigatória apenas quando há orçamento mantido', () => {
  for (const total of [0, 1, 2]) for (const marcada of [false, true]) {
    assert.equal(podeApagar({ motivo: 'ficha_duplicada', nomeConfere: true, orcamentosMantidos: total, caixaMarcada: marcada }), total === 0 || marcada);
  }
});

test('mapa apresenta recusas novas e mantém contexto inválido no genérico', () => {
  assert.equal(mensagemErroExclusao('confirmar_orcamento_aceito'), 'Marque a caixa de confirmação do orçamento aceito para apagar esta ficha.');
  assert.equal(mensagemErroExclusao('ficha_com_retirado'), 'Esta ficha tem procedimento retirado guardado no histórico e não pode ser apagada.');
  assert.equal(mensagemErroExclusao('ficha_com_encaminhamento'), 'Esta ficha tem procedimento encaminhado a outro dentista e não pode ser apagada.');
  assert.equal(mensagemErroExclusao('ficha_contexto_invalido'), 'Não foi possível apagar a ficha. Tente novamente.');
  assert.equal(mensagemErroExclusao('erro desconhecido'), mensagemErroExclusao('ficha_contexto_invalido'));
});

type Row = Record<string, string | number | boolean | null>;
type RpcCall = { nome: string; args: Record<string, unknown> };
const transpilar = (arquivo: string) => ts.transpileModule(readFileSync(arquivo, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const salvarCode = transpilar('src/server/patients/salvar-ficha.ts');

function servico(options: { rows?: Record<string, Row[]>; role?: string; rpcErro?: string; erroTabela?: string } = {}) {
  const rows: Record<string, Row[]> = {
    fichas: [{ id: 'ficha', paciente_id: 'paciente', dentista_id: 'autor', clinica_id: 'clinica', data_atendimento: '2026-10-25', assinado_em: null, assinatura_url: null }],
    pacientes: [{ id: 'paciente', nome: 'Paciente Sintético', clinica_id: 'clinica' }],
    ...options.rows,
  };
  const chamadas: RpcCall[] = [];
  const revalidacoes: string[] = [];
  let contextos = 0;
  const consultas: string[] = [];
  const supabase = {
    from(tabela: string) {
      consultas.push(tabela);
      const filtros: Array<(row: Row) => boolean> = [];
      let head = false;
      const resultado = () => {
        const data = (rows[tabela] ?? []).filter((row) => filtros.every((filtro) => filtro(row)));
        return { data: head ? null : data, count: data.length, error: options.erroTabela === tabela ? { message: 'falha sintética' } : null };
      };
      const query = {
        select(_colunas: string, config?: { head?: boolean }) { head = config?.head ?? false; return query; },
        eq(key: string, value: string | boolean) { filtros.push((row) => row[key] === value); return query; },
        neq(key: string, value: string) { filtros.push((row) => row[key] != null && row[key] !== value); return query; },
        in(key: string, values: string[]) { filtros.push((row) => values.includes(String(row[key]))); return query; },
        async maybeSingle() { const result = resultado(); return { ...result, data: result.data?.[0] ?? null }; },
        then(resolve: (value: ReturnType<typeof resultado>) => unknown) { return Promise.resolve(resultado()).then(resolve); },
        delete() { throw new Error('Delete direto proibido'); },
        update() { throw new Error('Update direto proibido'); },
      };
      return query;
    },
    async rpc(nome: string, args: Record<string, unknown>) {
      chamadas.push({ nome, args });
      return { data: options.rpcErro ? null : { exclusao_id: 'auditoria' }, error: options.rpcErro ? { message: options.rpcErro } : null };
    },
  };
  const loaded: {
    prepararExclusaoFicha(id: string): Promise<PrepararExclusaoFichaResult>;
    deletarFicha(id: string, confirmacao?: ConfirmacaoExclusaoFicha): Promise<DeletarFichaResult>;
  } = runInNewContext(salvarCode + '\nexports;', {
    exports: {}, console: { error() {} },
    require(nome: string) {
      if (nome === 'zod') return { z };
      if (nome === '@/server/auth/clinic') return { requireClinicContext: async () => { contextos++; return { supabase, clinicId: 'clinica', dentistaId: 'autor', role: options.role ?? 'dentista' }; } };
      if (nome === '@/lib/prontuario/exclusao-ficha') return { mensagemErroExclusao };
      if (nome === 'next/cache') return { revalidatePath: (path: string) => revalidacoes.push(path) };
      if (nome === '@/lib/odonto-dictionary') return { DENTES_FDI: {} };
      if (nome === '@/lib/activity-log') return { registrarLog() { throw new Error('Log clínico proibido'); } };
      return {};
    },
  });
  return { ...loaded, chamadas, revalidacoes, consultas, contextos: () => contextos };
}
// Apenas os schemas alheios à exclusão são inertes; as funções sob teste são as fontes reais.
const schema: object = new Proxy({}, { get: () => () => schema });
const confirmacao: ConfirmacaoExclusaoFicha = { motivo: 'ficha_duplicada', nomePaciente: 'Paciente Sintético', confirmaOrcamentoAceito: false };

test('chamador legado sem confirmação não acessa contexto nem banco', async () => {
  const service = servico();
  assert.equal((await service.deletarFicha('ficha')).error, 'Confirme a exclusão.');
  assert.equal(service.contextos(), 0);
  assert.equal(service.chamadas.length, 0);
});

test('exclusão usa exclusivamente RPC nova com cinco argumentos e checkbox explícita', async () => {
  for (const marcada of [false, true]) {
    const service = servico();
    assert.equal((await service.deletarFicha('ficha', { ...confirmacao, confirmaOrcamentoAceito: marcada })).ok, true);
    assert.equal(service.chamadas.length, 1);
    assert.equal(service.chamadas[0].nome, 'excluir_ficha_clinica');
    assert.deepEqual(JSON.parse(JSON.stringify(service.chamadas[0].args)), { p_ficha_id: 'ficha', p_motivo: 'ficha_duplicada', p_motivo_detalhe: null, p_nome_paciente: 'Paciente Sintético', p_confirma_orcamento_aceito: marcada });
    assert.deepEqual(service.revalidacoes, ['/dashboard/pacientes/paciente']);
  }
});

for (const codigo of ['sem_permissao', 'ficha_assinada', 'confirmar_orcamento_aceito', 'ficha_com_retirado', 'ficha_com_encaminhamento', 'ficha_contexto_invalido', 'cobranca_bloqueada']) {
  test(`RPC recusada: ${codigo} mantém mensagem e não revalida sucesso`, async () => {
    const service = servico({ rpcErro: codigo });
    assert.equal((await service.deletarFicha('ficha', confirmacao)).error, mensagemErroExclusao(codigo));
    assert.equal(service.revalidacoes.length, 0);
  });
}

test('prévia recusa admin não autor e papéis não clínicos', async () => {
  for (const role of ['admin', 'secretaria', 'protetico']) {
    const service = servico({ role, rows: { fichas: [{ id: 'ficha', paciente_id: 'paciente', dentista_id: 'outro', clinica_id: 'clinica' }] } });
    const result = await service.prepararExclusaoFicha('ficha');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, mensagemErroExclusao('sem_permissao'));
  }
});

test('prévia isola clínica e falha fechada em erro de leitura', async () => {
  for (const options of [
    { rows: { fichas: [{ id: 'ficha', paciente_id: 'paciente', dentista_id: 'autor', clinica_id: 'outra' }] } },
    { erroTabela: 'fichas' }, { erroTabela: 'ficha_arquivos' }, { erroTabela: 'pacientes' },
  ]) assert.equal((await servico(options).prepararExclusaoFicha('ficha')).ok, false);
});

test('prévia conta orçamentos diretos e pelas pontes, com todas as provas da M3', async () => {
  const ids = ['status', 'data', 'item', 'assinatura', 'documento', 'pagamento', 'cobranca', 'rascunho', 'ponte-sem-aceite'];
  const rows: Record<string, Row[]> = {
    odontograma_eventos: [{ id: 'evento', ficha_id: 'ficha', clinica_id: 'clinica' }],
    orcamentos: ids.map((id) => ({ id, clinica_id: 'clinica', paciente_id: 'paciente', ficha_id: id === 'cobranca' || id === 'ponte-sem-aceite' ? null : 'ficha', status: id === 'status' ? 'aprovado' : 'rascunho', aprovado_em: id === 'data' ? '2026-10-25' : null })),
    orcamento_eventos: ['cobranca', 'status', 'ponte-sem-aceite'].map((id) => ({ evento_id: 'evento', orcamento_id: id, clinica_id: 'clinica' })),
    orcamento_itens: [{ orcamento_id: 'item', aprovado: true, clinica_id: 'clinica' }],
    assinaturas: [{ orcamento_id: 'assinatura', ficha_id: 'ficha', tipo: 'orcamento', clinica_id: 'clinica' }],
    documentos_aceite: [{ orcamento_id: 'documento', ficha_id: 'ficha', tipo: 'orcamento', clinica_id: 'clinica' }],
    pagamentos: [{ orcamento_id: 'pagamento', clinica_id: 'clinica' }],
    orcamento_cobrancas: [{ orcamento_id: 'cobranca', clinica_id: 'clinica' }],
    ficha_arquivos: [{ ficha_id: 'ficha', clinica_id: 'clinica' }],
    ficha_evolucoes: [{ ficha_id: 'ficha', clinica_id: 'clinica' }],
  };
  const service = servico({ rows });
  const result = await service.prepararExclusaoFicha('ficha');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.resumo.orcamentosMantidos, 7);
    assert.equal(result.resumo.orcamentosApagados, 1);
    assert.equal(result.resumo.arquivos, 1);
    assert.equal(result.resumo.eventos, 1);
    assert.equal(result.resumo.evolucoes, 1);
    assert.equal(result.resumo.nomePaciente, 'Paciente Sintético');
  }
  assert.equal(service.chamadas.length, 0);
});

for (const [tabela, linha, codigo] of [
  ['odontograma_eventos', { assinatura_id: 'assinatura' }, 'ficha_assinada'],
  ['odontograma_eventos', { retirado_em: '2026-10-25' }, 'ficha_com_retirado'],
  ['odontograma_eventos', { encaminhado_para: 'outro' }, 'ficha_com_encaminhamento'],
  ['documentos_aceite', { tipo: 'clinico' }, 'ficha_assinada'],
  ['assinaturas', { tipo: 'clinico' }, 'ficha_assinada'],
] as const) {
  test(`prévia bloqueia ${codigo} em ${tabela}`, async () => {
    const result = await servico({ rows: { [tabela]: [{ id: 'registro', ficha_id: 'ficha', clinica_id: 'clinica', ...linha }] } }).prepararExclusaoFicha('ficha');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, mensagemErroExclusao(codigo));
  });
}

test('prévia recusa orçamento de outro paciente', async () => {
  const result = await servico({ rows: { orcamentos: [{ id: 'orcamento', ficha_id: 'ficha', clinica_id: 'clinica', paciente_id: 'outro' }] } }).prepararExclusaoFicha('ficha');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, mensagemErroExclusao('ficha_contexto_invalido'));
});

const visitaCode = transpilar('src/server/patients/registrar-atendimento-clinico.ts');
test('visita: descarta só a âncora criada nesta tentativa e preserva erro original mesmo com falha', async () => {
  for (const criada of [false, true]) for (const falha of ['nenhuma', 'recusa', 'excecao']) {
    let chamadas = 0;
    let logs = 0;
    const row = { id: 'visita', paciente_id: 'paciente', dentista_id: 'autor', agendamento_id: null, estado: 'preparando' };
    const service: { registrarAtendimentoClinico(input: RegistrarAtendimentoClinicoInput): Promise<RegistrarAtendimentoClinicoResult> } = runInNewContext(visitaCode + '\nexports;', {
      exports: {}, console: { error() { logs++; } },
      require(nome: string) {
        if (nome === '@/lib/hora-brt') return { hojeBRT: () => '2026-10-25' };
        if (nome === '@/server/patients/rotear-visita') return { rotearVisitaMeuDia: async () => ({ ok: false, error: 'Erro original sintético.' }) };
        if (nome === '@/server/auth/clinic') return { requireClinicContext: async () => ({ clinicId: 'clinica', dentistaId: 'autor', role: 'dentista', user: { id: 'usuario' }, supabase: {
          from(tabela: string) {
            let inserindo = false;
            const query = {
              select() { return query; }, eq() { return query; },
              insert() { inserindo = true; return query; },
              async maybeSingle() { return { data: tabela === 'pacientes' ? { id: 'paciente' } : inserindo || !criada ? row : null, error: null }; },
            };
            return query;
          },
          async rpc(nomeRpc: string, args: Record<string, string>) {
            chamadas++;
            assert.equal(nomeRpc, 'descartar_atendimento_vazio');
            assert.equal(args.p_atendimento_id, 'visita');
            if (falha === 'excecao') throw new Error('falha sintética');
            return { error: falha === 'recusa' ? { message: 'atendimento_com_conteudo' } : null };
          },
        } }) };
        return {};
      },
    });
    const result = await service.registrarAtendimentoClinico({ visitaKey: 'chave', pacienteId: 'paciente', origemAtendimento: 'ficha', textoVisita: 'Sintético', eventosDraft: [] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'Erro original sintético.');
    assert.equal(chamadas, criada ? 1 : 0);
    assert.equal(logs, criada && falha !== 'nenhuma' ? 1 : 0);
  }
});


test('regressão: movimento oculto pela RLS exige caixa após recusa da RPC, sem autorizar automaticamente', async () => {
  const service = servico({ rpcErro: 'confirmar_orcamento_aceito' });
  const previa = await service.prepararExclusaoFicha('ficha');
  assert.equal(previa.ok, true);
  if (!previa.ok) return;
  assert.equal(previa.resumo.orcamentosMantidos, 0);
  const recusada = await service.deletarFicha('ficha', confirmacao);
  assert.equal(recusada.ok, false);
  assert.equal(recusada.codigo, 'confirmar_orcamento_aceito');
  const resumo = recuperarConfirmacaoOrcamento(previa.resumo, recusada.codigo);
  assert.equal(resumo.orcamentosMantidos, 1);
  assert.equal(resumo.avisoOrcamentoPreservado, true);
  assert.equal(previa.resumo.orcamentosMantidos, 0);
  assert.equal(podeApagar({ ...confirmacao, nomeConfere: true, orcamentosMantidos: resumo.orcamentosMantidos, caixaMarcada: false }), false);
  assert.equal(podeApagar({ ...confirmacao, nomeConfere: true, orcamentosMantidos: resumo.orcamentosMantidos, caixaMarcada: true }), true);
  assert.equal(service.chamadas.length, 1);
  assert.equal(service.revalidacoes.length, 0);
  assert.equal(recuperarConfirmacaoOrcamento(resumo, recusada.codigo), resumo);
  assert.equal(recuperarConfirmacaoOrcamento(previa.resumo, 'sem_permissao'), previa.resumo);
  const sucesso = servico();
  assert.equal((await sucesso.deletarFicha('ficha', { ...confirmacao, confirmaOrcamentoAceito: true })).ok, true);
  assert.equal(sucesso.chamadas[0].args.p_confirma_orcamento_aceito, true);
});
