import fs from 'node:fs';
import path from 'node:path';
import { start, id, prefix, dir, rows, assert } from './harness.mjs';
const h = await start('10-inventario');
try {
  await h.check('Manifesto final para cleanup por lista exata; não executa limpeza', async () => {
    const patients = [1, 2, 3, 4, ...Array.from({ length: 36 }, (_, i) => 5000 + i), 6101, 6102, 6103].map(id);
    const tables = {};
    for (const table of ['pacientes', 'fichas', 'atendimentos_clinicos', 'agendamentos', 'odontograma_eventos', 'orcamentos', 'orcamento_cobrancas', 'pagamentos', 'assinaturas', 'prontuario_exclusoes', 'prontuario_exclusoes_copias']) {
      const key = table === 'prontuario_exclusoes_copias' ? 'exclusao_id' : 'id';
      const data = await rows(h.db.from(table).select(key + (table === 'assinaturas' ? ',assinatura_ref' : '')).in(table === 'pacientes' ? 'id' : 'paciente_id', patients));
      tables[table] = { column: key, ids: data.map(x => x[key]) };
      if (table === 'assinaturas') tables.storageFichas = { paths: data.map(x => x.assinatura_ref).filter(x => x?.includes('/' + id(1) + '/')) };
    }
    for (const [table, parent, parentIds] of [
      ['ficha_evolucoes', 'ficha_id', [101, 102, 103, 104, 105, 106, 107].map(id)],
      ['orcamento_itens', 'orcamento_id', [601, 602].map(id)],
      ['ficha_arquivos', 'ficha_id', [101, 102, 103, 104, 105, 106, 107].map(id)],
    ]) tables[table] = { column: 'id', ids: (await rows(h.db.from(table).select('id').in(parent, parentIds))).map(x => x.id) };
    assert.ok(tables.pacientes.ids.every(value => patients.includes(value)));
    const manifest = { prefix, patients, tables, cleanupExecuted: false, aviso: 'Preservar reprodução. Limpeza futura exclusivamente WHERE chave IN(ids enumerados), respeitando dependências; não usar faixa/nome/clínica. Revisar vínculos compostos e logs próprios antes de executar. Auditoria/cópias têm retenção própria; não excluir automaticamente.' };
    fs.writeFileSync(path.join(dir, 'fixtures-proprias-ids-exatos.json'), JSON.stringify(manifest, null, 2));
    return { manifesto: 'fixtures-proprias-ids-exatos.json', pacientes: patients.length, cleanupExecutado: false };
  });
} finally { await h.finish(); }
