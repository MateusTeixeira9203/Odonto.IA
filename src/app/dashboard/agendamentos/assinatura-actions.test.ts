import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { NADA_A_ASSINAR, usarCaminhoLegado } from '../../../lib/prontuario/assinatura-recepcao';

type Resultado = { ok: boolean; error?: string };
type Ficha = { id: string; clinica_id: string; paciente_id: string; assinado_em: string | null; assinatura_url: string | null };
const codigo = ts.transpileModule(readFileSync('src/app/dashboard/agendamentos/assinatura-actions.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const fichaId = 'ficha-qa';
const pacienteId = 'paciente-qa';
const clinicaId = 'clinica-qa';
const protegido = `${clinicaId}/${pacienteId}/assinatura_${fichaId}.png`;

function harness(options: {
  role?: string;
  ficha?: Partial<Ficha> | null;
  granular?: Resultado;
  eventos?: number | null;
  erroConsulta?: boolean;
  erroEventos?: boolean;
  erroUpload?: boolean;
  uploadRejeita?: boolean;
  uploadTransporte?: boolean;
  erroUpdate?: { code: string; message: string };
  updateRejeita?: boolean;
  updateZero?: boolean;
  erroRemover?: boolean;
  removerRejeita?: boolean;
} = {}) {
  let ficha: Ficha | null = options.ficha === null ? null : {
    id: fichaId, clinica_id: clinicaId, paciente_id: pacienteId, assinado_em: null, assinatura_url: null, ...options.ficha,
  };
  const arquivos = new Map<string, Buffer>([[protegido, Buffer.from('PROVA ORIGINAL')]]);
  const uploads: Array<{ path: string; upsert: boolean | undefined; bytes: Buffer }> = [];
  const removidos: string[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const granulares: unknown[] = [];
  let servicos = 0;
  let tentativas = 0;
  const storage = {
    async upload(path: string, bytes: Buffer, config: { upsert?: boolean }) {
      uploads.push({ path, upsert: config.upsert, bytes });
      if (options.uploadRejeita) { arquivos.set(path, bytes); throw new TypeError('Failed to fetch'); }
      if (options.uploadTransporte) { arquivos.set(path, bytes); return { error: { name: 'StorageUnknownError', message: 'Failed to fetch' } }; }
      if (options.erroUpload) return { error: { message: 'Upload recusado' } };
      if (arquivos.has(path) && !config.upsert) return { error: { message: 'Objeto ja existe' } };
      arquivos.set(path, bytes);
      return { error: null };
    },
    async remove(paths: string[]) {
      removidos.push(...paths);
      if (options.removerRejeita) throw new TypeError('Failed to fetch');
      if (options.erroRemover) return { error: { message: 'Remocao recusada' } };
      for (const path of paths) arquivos.delete(path);
      return { error: null };
    },
  };
  const db = {
    storage: { from(bucket: string) { assert.equal(bucket, 'fichas'); return storage; } },
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let patch: Record<string, string> | null = null;
      let retorno = false;
      const corresponde = () => ficha && Object.entries(filters).every(([k, v]) => ficha?.[k as keyof Ficha] === v);
      const query = {
        eq(key: string, value: unknown) { filters[key] = value; return query; },
        is(key: string, value: unknown) { if (table === 'fichas') filters[key] = value; return query; },
        select() { if (patch) retorno = true; return query; },
        update(dados: Record<string, string>) { patch = dados; updates.push(filters); return query; },
        async maybeSingle() {
          return { data: options.erroConsulta ? null : corresponde() ? { ...ficha } : null, error: options.erroConsulta ? { message: 'Consulta falhou' } : null };
        },
        then(resolve: (result: { data: Array<{ id: string }> | null; error: { code: string; message: string } | null; count?: number | null }) => unknown, reject?: (error: Error) => unknown) {
          if (table === 'odontograma_eventos') return Promise.resolve({ data: null, error: options.erroEventos ? { code: '42501', message: 'Consulta falhou' } : null, count: options.eventos === undefined ? 0 : options.eventos }).then(resolve, reject);
          if (options.updateRejeita) return Promise.reject(new TypeError('Failed to fetch')).then(resolve, reject);
          const alterada = !options.updateZero && !options.erroUpdate && corresponde();
          if (alterada && patch && ficha) ficha = { ...ficha, ...patch };
          return Promise.resolve({ data: retorno ? alterada ? [{ id: fichaId }] : [] : null, error: options.erroUpdate ?? null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const loaded: { salvarAssinaturaRecepcao(ficha: string, paciente: string, nome: string, data: string): Promise<Resultado> } = runInNewContext(codigo + '\nexports;', {
    exports: {}, Buffer, Date,
    require(name: string) {
      if (name === 'node:crypto') return { randomUUID: () => `tentativa-${++tentativas}` };
      if (name === '@/lib/prontuario/assinatura-recepcao') return { NADA_A_ASSINAR, usarCaminhoLegado };
      if (name === '@/server/auth/clinic') return { requireClinicContext: async () => ({ clinicId: clinicaId, role: options.role ?? 'secretaria' }) };
      if (name === '@/lib/supabase/service') return { createServiceClient: () => { servicos++; return db; } };
      if (name === '@/server/patients/registro-actions') return { assinarTodosRealizadosDaFicha: async (input: unknown) => { granulares.push(input); return options.granular ?? { ok: false, error: NADA_A_ASSINAR }; } };
      throw new Error('Dependencia nao prevista: ' + name);
    },
  });
  return { chamar: (data = 'data:image/png;base64,UUE=') => loaded.salvarAssinaturaRecepcao(fichaId, pacienteId, 'Paciente QA', data),
    arquivos, uploads, updates, removidos, granulares, ficha: () => ficha, servicos: () => servicos };
}

for (const campos of [
  { assinado_em: '2026-10-25T12:00:00Z' },
  { assinatura_url: protegido },
  { assinado_em: '2026-10-25T12:00:00Z', assinatura_url: protegido },
]) {
  test(`DQ-REC-03: ficha ja assinada ${JSON.stringify(campos)} recusa sem upload/update`, async () => {
    const h = harness({ ficha: campos }); const antes = JSON.stringify(h.ficha());
    const r = await h.chamar(); assert.equal(r.ok, false); assert.match(r.error ?? '', /assinada/);
    assert.equal(h.uploads.length, 0); assert.equal(h.updates.length, 0); assert.deepEqual(h.removidos, []);
    assert.equal(JSON.stringify(h.ficha()), antes); assert.equal(h.arquivos.get(protegido)?.toString(), 'PROVA ORIGINAL');
  });
}

test('DQ-REC-03: legado autorizado usa objeto unico sem sobrescrita e update condicionado', async () => {
  const h = harness(); const r = await h.chamar(); assert.equal(r.ok, true);
  assert.equal(h.uploads.length, 1); assert.equal(h.uploads[0].upsert, false);
  assert.notEqual(h.uploads[0].path, protegido); assert.equal(h.ficha()?.assinatura_url, h.uploads[0].path);
  assert(h.ficha()?.assinado_em); assert.equal(h.updates[0].assinado_em, null); assert.equal(h.updates[0].assinatura_url, null);
  assert.equal(h.updates[0].id, fichaId); assert.equal(h.updates[0].clinica_id, clinicaId);
  assert.equal(h.arquivos.get(protegido)?.toString(), 'PROVA ORIGINAL');
  assert.deepEqual(h.removidos, []);
});

test('DQ-REC-03: segundo envio nao substitui imagem nem carimbo do primeiro', async () => {
  const h = harness(); assert.equal((await h.chamar()).ok, true);
  const antes = JSON.stringify(h.ficha()); const path = h.ficha()!.assinatura_url!; const bytes = h.arquivos.get(path)!;
  assert.equal((await h.chamar('data:image/png;base64,QkI=')).ok, false);
  assert.equal(JSON.stringify(h.ficha()), antes); assert(h.arquivos.get(path)!.equals(bytes));
  assert.equal(h.uploads.length, 1); assert.equal(h.updates.length, 1);
});

test('DQ-REC-03: duas tentativas concorrentes preservam vencedor e removem so arquivo perdedor', async () => {
  const h = harness(); const resultados = await Promise.all([h.chamar(), h.chamar('data:image/png;base64,QkI=')]);
  assert.equal(resultados.filter((r) => r.ok).length, 1);
  assert.equal(resultados.filter((r) => !r.ok).length, 1);
  const vencedor = h.ficha()!.assinatura_url!;
  assert.equal(new Set(h.uploads.map((u) => u.path)).size, 2);
  assert.equal(h.arquivos.has(vencedor), true); assert.equal(h.arquivos.size, 2); // original protegido + vencedor
  assert.equal(h.removidos.length, 1); assert.notEqual(h.removidos[0], vencedor); assert.notEqual(h.removidos[0], protegido);
  assert.equal(h.arquivos.get(protegido)?.toString(), 'PROVA ORIGINAL');
});

for (const option of [
  { updateZero: true },
  { erroUpdate: { code: '23514', message: 'Falha confirmada do UPDATE' } },
]) {
  test(`DQ-REC-03: falha confirmada limpa somente arquivo da tentativa ${JSON.stringify(option)}`, async () => {
    const h = harness(option); const antes = JSON.stringify(h.ficha()); const r = await h.chamar();
    assert.equal(r.ok, false); if ('updateZero' in option) assert.equal(r.error, 'Registro nao encontrado.');
    assert.equal(h.arquivos.size, 1); assert.equal(h.removidos[0], h.uploads[0].path);
    assert.equal(JSON.stringify(h.ficha()), antes); assert.equal(h.arquivos.get(protegido)?.toString(), 'PROVA ORIGINAL');
  });
}

test('DQ-REC-03: rejeicao incerta do UPDATE nao apaga arquivo possivelmente vinculado', async () => {
  const h = harness({ updateRejeita: true }); const r = await h.chamar();
  assert.equal(r.ok, false); assert.match(r.error ?? '', /confirmar/); assert.deepEqual(h.removidos, []);
  assert.equal(h.uploads.length, 1); assert.equal(h.uploads[0].upsert, false);
  assert.equal(h.arquivos.has(h.uploads[0].path), true);
});

test('DQ-REC-03: falha de limpeza e reportada, sem apagar prova anterior', async () => {
  const h = harness({ updateZero: true, erroRemover: true }); const r = await h.chamar();
  assert.equal(r.ok, false); assert.match(r.error ?? '', /arquivo/); assert.equal(h.removidos.length, 1);
  assert.notEqual(h.removidos[0], protegido); assert.equal(h.arquivos.get(protegido)?.toString(), 'PROVA ORIGINAL');
});

test('DQ-REC-03: upload recusado nao chega ao UPDATE nem remove arquivos existentes', async () => {
  const h = harness({ erroUpload: true }); const r = await h.chamar();
  assert.equal(r.ok, false); assert.equal(h.updates.length, 0); assert.deepEqual(h.removidos, []);
  assert.equal(h.arquivos.size, 1);
});

for (const ficha of [null, { clinica_id: 'outra-clinica' }, { paciente_id: 'outro-paciente' }]) {
  test(`DQ-REC-03: contexto inexistente/divergente nao escreve ${JSON.stringify(ficha)}`, async () => {
    const h = harness({ ficha }); assert.equal((await h.chamar()).ok, false);
    assert.equal(h.uploads.length, 0); assert.equal(h.updates.length, 0);
  });
}
for (const options of [{ eventos: 1 }, { eventos: null }, { erroEventos: true }, { erroConsulta: true }]) {
  test(`DQ-REC-03: leitura falha ou ha eventos nao usa legado ${JSON.stringify(options)}`, async () => {
    const h = harness(options); assert.equal((await h.chamar()).ok, false); assert.equal(h.uploads.length, 0); assert.equal(h.updates.length, 0);
  });
}
for (const role of ['dentista', 'admin', 'protetico']) {
  test(`DQ-REC-03: papel ${role} continua recusado antes de qualquer fluxo`, async () => {
    const h = harness({ role }); assert.equal((await h.chamar()).ok, false);
    assert.equal(h.granulares.length, 0); assert.equal(h.servicos(), 0);
  });
}
for (const granular of [{ ok: true }, { ok: false, error: 'REC-4 parcial: encaminhado pendente.' }]) {
  test(`DQ-REC-03: resultado granular/REC-4 e preservado ${JSON.stringify(granular)}`, async () => {
    const h = harness({ granular }); assert.deepEqual(await h.chamar(), granular); assert.equal(h.servicos(), 0);
    assert.deepEqual(JSON.parse(JSON.stringify(h.granulares[0])), { fichaId, pacienteId, assinadoPor: 'Paciente QA', assinaturaDataUrl: 'data:image/png;base64,UUE=' });
  });
}


test('DQ-REC-03: erro de transporte retornado pelo UPDATE mantem resultado incerto sem apagar arquivo', async () => {
  const h = harness({ erroUpdate: { code: '', message: 'Failed to fetch' } });
  const r = await h.chamar(); assert.equal(r.ok, false); assert.match(r.error ?? '', /confirmar/);
  assert.deepEqual(h.removidos, []); assert.equal(h.arquivos.has(h.uploads[0].path), true);
});

test('DQ-REC-03: upload que criou objeto e rejeitou e compensado antes de qualquer UPDATE', async () => {
  const h = harness({ uploadRejeita: true }); const r = await h.chamar();
  assert.equal(r.ok, false); assert.equal(h.updates.length, 0);
  assert.equal(h.removidos[0], h.uploads[0].path); assert.equal(h.arquivos.size, 1);
  assert.equal(h.arquivos.get(protegido)?.toString(), 'PROVA ORIGINAL');
});

test('DQ-REC-03: rejeicao da limpeza retorna pendencia sem excecao nem dano ao arquivo protegido', async () => {
  const h = harness({ updateZero: true, removerRejeita: true }); const r = await h.chamar();
  assert.equal(r.ok, false); assert.match(r.error ?? '', /arquivo/);
  assert.notEqual(h.removidos[0], protegido); assert.equal(h.arquivos.get(protegido)?.toString(), 'PROVA ORIGINAL');
});

test('DQ-REC-03: SDK que devolve falha de transporte do upload limpa somente tentativa sem UPDATE', async () => {
  const h = harness({ uploadTransporte: true }); const r = await h.chamar();
  assert.equal(r.ok, false); assert.equal(h.updates.length, 0);
  assert.equal(h.removidos[0], h.uploads[0].path); assert.equal(h.arquivos.size, 1);
  assert.equal(h.arquivos.get(protegido)?.toString(), 'PROVA ORIGINAL');
});
