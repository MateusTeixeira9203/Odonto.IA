import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Resultado = { error?: string };
type Row = Record<string, unknown> & { id: string; clinica_id: string };
type Acoes = {
  marcarNoShow(id: string): Promise<Resultado>;
  cancelarComMotivo(id: string, motivo: string | null): Promise<Resultado>;
  deletarAgendamento(id: string): Promise<Resultado>;
  atualizarPaciente(id: string, dados: { nome: string }): Promise<Resultado>;
};
const nativeRequire = createRequire(import.meta.url);
const compilar = (file: string) => ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const agendaCode = compilar('src/app/dashboard/agendamentos/actions.ts');
const pacienteCode = compilar('src/app/dashboard/pacientes/[id]/actions.ts');
const registroId = 'registro-sintetico';

function harness(options: {
  clinicaRegistro?: string;
  ausente?: boolean;
  zeroNaMutacao?: boolean;
  erroMutacao?: string;
  role?: 'admin' | 'dentista' | 'secretaria';
} = {}) {
  const rows: Record<string, Row | null> = {
    agendamentos: options.ausente ? null : {
      id: registroId, clinica_id: options.clinicaRegistro ?? 'clinica-ativa',
      dentista_id: 'dentista-sintetico', google_event_id: 'evento-sintetico',
      data_hora: '2026-11-16T13:00:00Z', observacoes: 'Observacao sintetica',
      paciente: { nome: 'Paciente sintetico' }, status: 'scheduled',
    },
    pacientes: options.ausente ? null : {
      id: registroId, clinica_id: options.clinicaRegistro ?? 'clinica-ativa', nome: 'Paciente sintetico',
    },
  };
  const antes = JSON.stringify(rows);
  const revalidacoes: string[] = [];
  const google: Array<[string, string]> = [];
  const notificacoes: Array<Record<string, unknown>> = [];
  let afetadas = 0;
  const supabase = {
    from(table: string) {
      const filtros: Record<string, string> = {};
      let operacao: 'update' | 'delete' | null = null;
      let patch: Record<string, unknown> = {};
      let devolver = false;
      const ler = () => {
        const row = rows[table];
        return row && Object.entries(filtros).every(([key, value]) => row[key] === value) ? row : null;
      };
      const query = {
        eq(key: string, value: string) { filtros[key] = value; return query; },
        select() { if (operacao) devolver = true; return query; },
        update(dados: Record<string, unknown>) { operacao = 'update'; patch = dados; return query; },
        delete() { operacao = 'delete'; return query; },
        async maybeSingle() { return { data: ler(), error: null }; },
        then(resolve: (result: { data: Array<{ id: string }> | null; error: { message: string } | null }) => unknown) {
          const row = ler();
          const error = options.erroMutacao ? { message: options.erroMutacao } : null;
          const alterada = row && !options.zeroNaMutacao && !error;
          if (alterada && operacao) {
            afetadas++;
            rows[table] = operacao === 'delete' ? null : { ...row, ...patch };
          }
          return Promise.resolve({ data: devolver ? alterada ? [{ id: row.id }] : [] : null, error }).then(resolve);
        },
      };
      return query;
    },
  };
  const load = (code: string) => runInNewContext(code + '\nexports;', {
    exports: {}, Date, console: { error() {} },
    require(name: string) {
      if (name === 'zod' || name === 'date-fns' || name === 'date-fns/locale') return nativeRequire(name);
      if (name === '@/server/auth/clinic') return { requireClinicContext: async () => ({
        supabase, clinicId: 'clinica-ativa', dentistaId: 'dentista-sintetico', role: options.role ?? 'dentista',
      }) };
      if (name === 'next/cache') return { revalidatePath: (path: string) => revalidacoes.push(path) };
      if (name === '@/lib/calendar/google-provider') return {
        deleteGoogleCalendarEvent: async (dentista: string, evento: string) => { google.push([dentista, evento]); },
      };
      if (name === '@/lib/notificacoes') return {
        inserirNotificacao: async (_db: unknown, dados: Record<string, unknown>) => { notificacoes.push(dados); },
      };
      if (name === '@/server/patients/buscar-duplicatas') return { buscarPossiveisDuplicatas: async () => [] };
      return {};
    },
  });
  const acoes: Acoes = { ...load(agendaCode), ...load(pacienteCode) };
  return { acoes, rows, antes, revalidacoes, google, notificacoes, afetadas: () => afetadas };
}

const executar: Record<keyof Acoes, (acoes: Acoes) => Promise<Resultado>> = {
  marcarNoShow: (acoes) => acoes.marcarNoShow(registroId),
  cancelarComMotivo: (acoes) => acoes.cancelarComMotivo(registroId, 'Motivo sintetico'),
  deletarAgendamento: (acoes) => acoes.deletarAgendamento(registroId),
  atualizarPaciente: (acoes) => acoes.atualizarPaciente(registroId, { nome: 'Nome sintetico atualizado' }),
};

for (const nome of Object.keys(executar) as Array<keyof Acoes>) {
  for (const [cenario, options] of [
    ['outra clinica', { clinicaRegistro: 'outra-clinica' }],
    ['ID inexistente', { ausente: true }],
    ['RLS/race: mutacao retorna zero mesmo apos leitura', { zeroNaMutacao: true }],
  ] as const) {
    test(`DQ-ISOLAMENTO ${nome}: ${cenario} recusa explicitamente sem efeitos`, async () => {
      const h = harness(options);
      const result = await executar[nome](h.acoes);
      assert.equal(result.error, 'Registro nao encontrado.');
      assert.equal(h.afetadas(), 0);
      assert.equal(JSON.stringify(h.rows), h.antes);
      assert.deepEqual(h.revalidacoes, []);
      assert.deepEqual(h.google, []);
      assert.deepEqual(h.notificacoes, []);
    });
  }
  test(`DQ-ISOLAMENTO ${nome}: erro real da mutacao e preservado`, async () => {
    const h = harness({ erroMutacao: 'Erro sintetico do banco' });
    assert.equal((await executar[nome](h.acoes)).error, 'Erro sintetico do banco');
    assert.equal(h.afetadas(), 0);
    assert.equal(JSON.stringify(h.rows), h.antes);
    assert.deepEqual(h.revalidacoes, []);
    assert.deepEqual(h.google, []);
    assert.deepEqual(h.notificacoes, []);
  });
  for (const role of ['admin', 'dentista', 'secretaria'] as const) {
    test(`DQ-ISOLAMENTO ${nome}: sucesso da propria clinica preservado para ${role}`, async () => {
      const h = harness({ role });
      assert.equal(JSON.stringify(await executar[nome](h.acoes)), '{}');
      const mudaGoogle = nome === 'cancelarComMotivo' || nome === 'deletarAgendamento';
      assert.equal(h.afetadas(), nome === 'cancelarComMotivo' ? 2 : 1); // segunda escrita limpa google_event_id
      assert.deepEqual(h.google, mudaGoogle ? [['dentista-sintetico', 'evento-sintetico']] : []);
      assert.deepEqual(h.revalidacoes, [nome === 'atualizarPaciente' ? `/dashboard/pacientes/${registroId}` : '/dashboard/agendamentos']);
      assert.equal(h.notificacoes.length, nome === 'cancelarComMotivo' && role === 'secretaria' ? 1 : 0);
      if (nome === 'cancelarComMotivo') {
        assert.equal(h.rows.agendamentos?.status, 'cancelled');
        assert.equal(h.rows.agendamentos?.observacoes, '[Cancelado: Motivo sintetico]\nObservacao sintetica');
        assert.equal(h.rows.agendamentos?.google_event_id, null);
      } else if (nome === 'marcarNoShow') assert.equal(h.rows.agendamentos?.status, 'no_show');
      else if (nome === 'deletarAgendamento') assert.equal(h.rows.agendamentos, null);
      else assert.equal(h.rows.pacientes?.nome, 'Nome sintetico atualizado');
    });
  }
}
