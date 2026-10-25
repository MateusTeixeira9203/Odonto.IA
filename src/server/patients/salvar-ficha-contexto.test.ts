import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { SalvarFichaInput, SalvarFichaResult } from './salvar-ficha';
import type { ImportarHistoricoInput } from './importar-historico';

const nativeRequire = createRequire(import.meta.url);
const source = readFileSync('src/server/patients/salvar-ficha.ts', 'utf8');
const pacienteId = 'e0000000-0000-4000-8000-000000001501';
const fichaId = 'e0000000-0000-4000-8000-000000001502';
const agendamentoId = 'e0000000-0000-4000-8000-000000001503';
const input: SalvarFichaInput = {
  pacienteId, origem: 'manual', dataAtendimento: '2026-10-24',
  queixaPrincipal: '', anotacoes: 'QA sintético', dentesAfetados: [], dentesObservacoes: {}, procedimentos: [], conduta: '',
};

function harness(options: {
  pacienteClinica?: string;
  pacienteAusente?: boolean;
  fichaClinica?: string;
  fichaPaciente?: string;
  agenda?: Record<string, string>;
  erroTabela?: string;
} = {}) {
  let escritas = 0;
  const rows: Record<string, Record<string, string> | null> = {
    pacientes: options.pacienteAusente ? null : { id: pacienteId, clinica_id: options.pacienteClinica ?? 'clinica' },
    fichas: { id: fichaId, clinica_id: options.fichaClinica ?? 'clinica', paciente_id: options.fichaPaciente ?? pacienteId, dentista_id: 'dentista' },
    agendamentos: options.agenda ?? { id: agendamentoId, clinica_id: 'clinica', paciente_id: pacienteId, dentista_id: 'dentista' },
  };
  const supabase = {
    from(table: string) {
      const filters: Record<string, string> = {};
      let inserindo = false;
      function result() {
        const row = rows[table];
        const error = options.erroTabela === table ? { message: 'falha sintética' } : null;
        return { data: error ? null : inserindo ? { id: fichaId }
          : row && Object.entries(filters).every(([k, v]) => row[k] === v) ? row : null, error, count: 0 };
      }
      const query = {
        select() { return query; },
        eq(key: string, value: string) { filters[key] = value; return query; },
        is() { return query; },
        insert() { escritas++; inserindo = true; return query; },
        update() { escritas++; return query; },
        async single() { return result(); },
        async maybeSingle() { return result(); },
        then(resolve: (value: ReturnType<typeof result>) => unknown) { return Promise.resolve(result()).then(resolve); },
      };
      return query;
    },
  };
  function load(code: string, overrides: Record<string, unknown> = {}) {
    const output = ts.transpileModule(code, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    return runInNewContext(output + '\nexports;', { exports: {}, Date, console: { error() {} }, require(name: string) {
      if (name in overrides) return overrides[name];
      if (name === 'zod') return nativeRequire(name);
      if (name === '@/server/auth/clinic') return { requireClinicContext: async () => ({ supabase, clinicId: 'clinica', dentistaId: 'dentista', role: 'dentista' }) };
      if (name === '@/lib/odonto-dictionary') return { DENTES_FDI: {} };
      if (name === '@/lib/events') return { EVENTS: {}, ENTITY_TYPES: {} };
      if (name === '@/lib/activity-log') return { registrarLog() {} };
      if (name === '@/lib/hora-brt') return { hojeBRT: () => '2026-10-24' };
      if (name === '@/server/patients/finalizar-atendimento') return { finalizarAtendimentoSeAplicavel: async () => {} };
      if (name === 'next/cache') return { revalidatePath() {} };
      return {};
    } });
  }
  const ficha: { salvarFicha(data: SalvarFichaInput): Promise<SalvarFichaResult> } = load(source);
  const word: { importarHistoricoDoWord(data: ImportarHistoricoInput): Promise<SalvarFichaResult> } = load(
    readFileSync('src/server/patients/importar-historico.ts', 'utf8'), { './salvar-ficha': ficha },
  );
  return { ...ficha, ...word, escritas: () => escritas };
}

for (const options of [{ pacienteClinica: 'outra' }, { pacienteAusente: true }, { erroTabela: 'pacientes' }]) {
  for (const entry of ['salvarFicha', 'importarHistoricoDoWord'] as const) {
    test(`A2 ${entry}: paciente inválido ${JSON.stringify(options)} recusa sem escrita`, async () => {
      const service = harness(options);
      const result = entry === 'salvarFicha' ? await service.salvarFicha(input)
        : await service.importarHistoricoDoWord({ pacienteId, dataAtendimento: input.dataAtendimento, texto: input.anotacoes });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error, 'Registro nao encontrado.');
      assert.equal(service.escritas(), 0);
    });
  }
}

for (const options of [{ fichaClinica: 'outra' }, { fichaPaciente: 'outro' }, { erroTabela: 'fichas' }]) {
  test(`A2 edição: ficha inválida ${JSON.stringify(options)} recusa antes de alterar`, async () => {
    const service = harness(options);
    const result = await service.salvarFicha({ ...input, fichaId });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'Registro nao encontrado.');
    assert.equal(service.escritas(), 0);
  });
}

for (const agenda of [
  { id: agendamentoId, clinica_id: 'outra', paciente_id: pacienteId, dentista_id: 'dentista' },
  { id: agendamentoId, clinica_id: 'clinica', paciente_id: 'outro', dentista_id: 'dentista' },
  { id: agendamentoId, clinica_id: 'clinica', paciente_id: pacienteId, dentista_id: 'outro' },
]) {
  test(`A2 salvarFicha direto: agenda incoerente ${JSON.stringify(agenda)} recusa sem escrita`, async () => {
    const service = harness({ agenda });
    const result = await service.salvarFicha({ ...input, agendamentoId });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'Registro nao encontrado.');
    assert.equal(service.escritas(), 0);
  });
}

test('A2 paciente próprio: salvarFicha e importação continuam criando uma ficha cada', async () => {
  const service = harness();
  assert.equal((await service.salvarFicha(input)).ok, true);
  assert.equal((await service.importarHistoricoDoWord({ pacienteId, dataAtendimento: input.dataAtendimento, texto: input.anotacoes })).ok, true);
  assert.equal(service.escritas(), 2);
});
