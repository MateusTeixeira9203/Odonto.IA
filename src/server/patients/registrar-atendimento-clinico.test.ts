import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { RegistrarAtendimentoClinicoInput, RegistrarAtendimentoClinicoResult } from './registrar-atendimento-clinico';

// Load the real module without executing its server-only dependencies.
const source = readFileSync('src/server/patients/registrar-atendimento-clinico.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports: { papelPodeRegistrarClinico(role: string): boolean; MENSAGEM_VISITA_FINALIZADA: string } =
  runInNewContext(output + '\nexports;', { exports: {}, require: () => ({}) });

for (const role of ['admin', 'dentista']) {
  test(`registro clinico permite ${role}`, () => {
    assert.equal(exports.papelPodeRegistrarClinico(role), true);
  });
}
for (const role of ['secretaria', 'protetico', 'desconhecido', '']) {
  test(`registro clinico recusa ${role || 'papel vazio'}`, () => {
    assert.equal(exports.papelPodeRegistrarClinico(role), false);
  });
}
test('visita finalizada orienta sobre o texto acrescentado e Novo atendimento', () => {
  assert.equal(exports.MENSAGEM_VISITA_FINALIZADA,
    'Esta visita j\u00e1 foi finalizada e est\u00e1 salva na Ficha. Se voc\u00ea acrescentou algo depois, isso n\u00e3o foi gravado: use Novo atendimento na Ficha do paciente.');
});

const input: RegistrarAtendimentoClinicoInput = {
  visitaKey: 'visita', pacienteId: 'paciente', agendamentoId: 'agenda',
  textoVisita: 'Registro sintético', eventosDraft: [],
};

function servicoComContexto(options: {
  role?: string;
  paciente?: Record<string, string> | null;
  agendamento?: Record<string, string> | null;
  erroTabela?: string;
  finalizado?: boolean;
  semAgenda?: boolean;
} = {}, code = output) {
  const consultas: string[] = [];
  let roteamentos = 0;
  const rows: Record<string, Record<string, string | null> | null> = {
    pacientes: options.paciente === undefined ? { id: 'paciente', clinica_id: 'clinica' } : options.paciente,
    agendamentos: options.agendamento === undefined
      ? { id: 'agenda', clinica_id: 'clinica', paciente_id: 'paciente', dentista_id: 'dentista' }
      : options.agendamento,
    atendimentos_clinicos: {
      id: 'atendimento', clinica_id: 'clinica', chave_idempotencia: 'visita',
      paciente_id: 'paciente', dentista_id: 'dentista', agendamento_id: options.semAgenda ? null : 'agenda',
      estado: options.finalizado ? 'finalizado' : 'preparando',
    },
  };
  const supabase = {
    from(table: string) {
      consultas.push(table);
      const filters: Record<string, string> = {};
      const query = {
        select() { return query; },
        eq(key: string, value: string) { filters[key] = value; return query; },
        async maybeSingle() {
          const row = rows[table];
          const error = options.erroTabela === table ? { message: 'falha sintética' } : null;
          return { data: !error && row && Object.entries(filters).every(([key, value]) => row[key] === value) ? row : null, error };
        },
        insert() { throw new Error('Escrita inesperada'); },
        update() { throw new Error('Escrita inesperada'); },
      };
      return query;
    },
  };
  const loaded: {
    registrarAtendimentoClinico(dados: RegistrarAtendimentoClinicoInput): Promise<RegistrarAtendimentoClinicoResult>;
  } = runInNewContext(code + '\nexports;', {
    exports: {},
    require(name: string) {
      if (name === '@/server/auth/clinic') return { requireClinicContext: async () => ({
        supabase, clinicId: 'clinica', dentistaId: 'dentista', role: options.role ?? 'dentista', user: { id: 'usuario' },
      }) };
      if (name === '@/server/patients/rotear-visita') return { rotearVisitaMeuDia: async () => {
        roteamentos++;
        return { ok: false, error: 'Roteamento alcançado.' };
      } };
      return {};
    },
  });
  return { executar: loaded.registrarAtendimentoClinico, consultas, roteamentos: () => roteamentos };
}

for (const [label, options] of Object.entries({
  'paciente de outra clínica': { paciente: { id: 'paciente', clinica_id: 'outra' } },
  'paciente inexistente': { paciente: null },
  'agendamento de outra clínica': { agendamento: { id: 'agenda', clinica_id: 'outra', paciente_id: 'paciente', dentista_id: 'dentista' } },
  'agendamento de outro paciente': { agendamento: { id: 'agenda', clinica_id: 'clinica', paciente_id: 'outro', dentista_id: 'dentista' } },
  'agendamento de outro dentista': { agendamento: { id: 'agenda', clinica_id: 'clinica', paciente_id: 'paciente', dentista_id: 'outro' } },
  'agendamento inexistente': { agendamento: null },
  'erro lendo paciente': { erroTabela: 'pacientes' },
  'erro lendo agendamento': { erroTabela: 'agendamentos' },
})) {
  test(`SEC-B1: ${label} recusa antes da âncora e do roteamento`, async () => {
    const service = servicoComContexto(options);
    const result = await service.executar(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'Registro nao encontrado.');
    assert.deepEqual(service.consultas, ['pacientes', 'agendamentos']);
    assert.equal(service.roteamentos(), 0);
  });
}

test('SEC-B1: Prontuário sem agenda valida paciente antes de qualquer âncora', async () => {
  const service = servicoComContexto({ paciente: null });
  const result = await service.executar({ ...input, origemAtendimento: 'ficha', agendamentoId: undefined });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'Registro nao encontrado.');
  assert.deepEqual(service.consultas, ['pacientes']);
});

test('SEC-B1: Prontuário válido continua sem exigir agenda', async () => {
  const service = servicoComContexto({ semAgenda: true });
  await service.executar({ ...input, origemAtendimento: 'ficha', agendamentoId: undefined });
  assert.deepEqual(service.consultas, ['pacientes', 'atendimentos_clinicos']);
  assert.equal(service.roteamentos(), 1);
});

for (const role of ['secretaria', 'protetico']) {
  test(`SEC-B1: ${role} continua recusado antes das consultas de validação`, async () => {
    const service = servicoComContexto({ role });
    const result = await service.executar(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'Sem permissão.');
    assert.deepEqual(service.consultas, []);
  });
}

test('SEC-B1: contexto válido alcança o roteador; visita finalizada preserva a frase', async () => {
  const normal = servicoComContexto();
  await normal.executar(input);
  assert.equal(normal.roteamentos(), 1);
  const finalizado = servicoComContexto({ finalizado: true });
  const result = await finalizado.executar(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, exports.MENSAGEM_VISITA_FINALIZADA);
  assert.equal(finalizado.roteamentos(), 0);
});
