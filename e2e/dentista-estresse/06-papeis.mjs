import fs from 'node:fs';
import path from 'node:path';
import { start, id, name, base, dir, assert, rows } from './harness.mjs';
const h = await start('06-papeis');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx1sAAAAASUVORK5CYII=';
try {
  const a = await h.login('ANA'), s = await h.login('SARA'), admin = await h.login('ADMIN'), b = await h.login('BRUNO');
  await a.page.goto(base + '/dashboard/pacientes/' + id(1));
  await a.page.getByRole('tab', { name: 'Prontuário', exact: true }).click();
  await s.page.goto(base + '/dashboard/agendamentos');
  await h.check('Sara PDF administrativo mostra paciente/orçamento/consultas, omite dados clínicos; ficha 403', async () => {
    const r = await s.page.request.get(base + '/api/pacientes/' + id(1) + '/prontuario');
    assert.equal(r.status(), 200); const html = await r.text();
    fs.writeFileSync(path.join(dir, '06-pdf-administrativo.html'), html);
    assert.ok(html.includes(name)); assert.ok(html.includes('Versão administrativa: sem dados clínicos.'));
    assert.ok(html.includes('Orçamentos')); assert.ok(html.includes('Consultas')); assert.ok(html.includes('QA D2 Item Fictício'));
    for (const forbidden of ['QA-D2-QUEIXA-PRIVADA', 'QA-D2-CLINICO-PRIVADO', 'QA D2 Evolução', 'QA D2 Procedimento', 'Fichas Clínicas']) assert.ok(!html.includes(forbidden), 'Não deve expor ' + forbidden);
    const clinical = await s.page.request.get(base + '/api/fichas/' + id(104) + '/pdf'); assert.equal(clinical.status(), 403);
    await s.page.goto(base + '/dashboard/pacientes/' + id(1));
    assert.equal(await s.page.getByRole('tab', { name: 'Prontuário', exact: true }).count(), 0);
    return { prontuarioHttp: r.status(), fichaHttp: clinical.status(), html: '06-pdf-administrativo.html', clinicoOmitido: true };
  }, s.page);
  await h.check('Admin PDF completo contém conteúdo clínico sintético; protético não exporta prontuário', async () => {
    const r = await admin.page.request.get(base + '/api/pacientes/' + id(1) + '/prontuario'); assert.equal(r.status(), 200);
    const html = await r.text(); assert.ok(html.includes('QA-D2-CLINICO-PRIVADO')); assert.ok(html.includes('Fichas Clínicas'));
    const prot = await h.login('PROTETICO'); const denied = await prot.page.request.get(base + '/api/pacientes/' + id(1) + '/prontuario'); assert.equal(denied.status(), 404);
    return { admin: 200, protetico: 404 };
  });
  await h.check('M3 dentista alheio e admin não apagam ficha da Ana; cópia só admin', async () => {
    const before = await h.ownState(); const results = {};
    for (const [role, session] of [['BRUNO', b], ['ADMIN', admin]]) {
      const r = await session.client.rpc('excluir_ficha_clinica', { p_ficha_id: id(104), p_motivo: 'aberta_por_engano', p_motivo_detalhe: null, p_nome_paciente: name, p_confirma_orcamento_aceito: false });
      assert.ok(r.error); results[role] = { code: r.error.code, message: r.error.message };
    }
    const copy = await h.get('prontuario_exclusoes_copias', id(101), 'ficha_id'); assert.equal(copy.length, 1, 'lote05 deve criar cópia');
    for (const session of [a, s, b]) { const r = await session.client.from('prontuario_exclusoes_copias').select('exclusao_id').eq('exclusao_id', copy[0].exclusao_id); assert.ok(r.error || r.data.length === 0); }
    assert.equal((await rows(admin.client.from('prontuario_exclusoes_copias').select('exclusao_id').eq('exclusao_id', copy[0].exclusao_id))).length, 1);
    assert.deepEqual(await h.ownState(), before); return { results, copia: copy[0].exclusao_id, semEfeito: true };
  });
  await h.check('Sara assina procedimentos da Ana com CRO da Ana e sem carimbar ficha', async () => {
    const before = (await h.get('fichas', id(104)))[0];
    const r = await h.action('SARA', 'salvarAssinaturaRecepcao', [id(104), id(1), name, png], '/dashboard/agendamentos'); assert.equal(r.ok, true, r.error);
    const event = (await h.get('odontograma_eventos', id(302)))[0]; assert.ok(event.assinatura_id);
    const sig = (await h.get('assinaturas', event.assinatura_id))[0]; assert.equal(sig.dentista_id, a.id); assert.equal(sig.cro_no_ato, a.cro);
    const ficha = (await h.get('fichas', id(104)))[0]; assert.equal(ficha.assinado_em, before.assinado_em); assert.equal(ficha.assinatura_url, before.assinatura_url);
    return { evento: id(302), assinatura: sig.id, dentista: a.id, croCorreto: true, fichaNaoCarimbada: true, storagePath: sig.assinatura_ref };
  });
  await h.check('Fixtures assinatura mista/encaminhada só próprias', async () => {
    const data = [[304, a.id, null], [305, admin.id, null], [306, a.id, admin.id]].map(([n, owner, receiver]) => ({ id: id(n), clinica_id: a.clinica_id, paciente_id: id(1), ficha_id: id(107), dentista_id: owner, encaminhado_para: receiver, tipo: 'profilaxia', status: 'realizado', origem: 'clinica', nivel: 'boca', faces: [], momento_planejado: 'sessao_atual', procedimento_nome: `QA D2 Autoria ${n}`, realizado_em: '2026-10-25' }));
    await rows(h.db.from('odontograma_eventos').insert(data).select('id')); return { ids: data.map(x => x.id) };
  });
  await h.check('RPC recusa seleção mista de autores sem assinatura parcial', async () => {
    const before = await h.ownState(); const r = await s.client.rpc('assinar_procedimentos', { p_evento_ids: [id(304), id(305)], p_assinado_por: name, p_assinatura_ref: 'qa/d025d200/misto-sem-binario.png' });
    assert.match(r.error?.message ?? '', /autores_diferentes/); assert.deepEqual(await h.ownState(), before); return { codigo: r.error.code, mensagem: r.error.message, semEfeito: true };
  });
  await h.check('REC-4 recepção separa autores; encaminhado continua pendente, sem carimbo legado', async () => {
    const r = await h.action('SARA', 'salvarAssinaturaRecepcao', [id(107), id(1), name, png], '/dashboard/agendamentos');
    assert.equal(r.ok, false); assert.match(r.error, /2 procedimento\(s\) assinado\(s\).*1 procedimento\(s\) encaminhado/s);
    const events = await rows(h.db.from('odontograma_eventos').select('*').in('id', [id(304), id(305), id(306)]));
    const signed = events.filter(e => e.assinatura_id); assert.equal(signed.length, 2); assert.equal(events.find(e => e.id === id(306)).assinatura_id, null);
    const sigs = await rows(h.db.from('assinaturas').select('*').in('id', signed.map(e => e.assinatura_id))); assert.equal(sigs.length, 2);
    for (const e of signed) { const sig = sigs.find(x => x.id === e.assinatura_id); const author = e.dentista_id === a.id ? a : admin; assert.equal(sig.dentista_id, author.id); assert.equal(sig.cro_no_ato, author.cro); }
    const ficha = (await h.get('fichas', id(107)))[0]; assert.equal(ficha.assinado_em, null); assert.equal(ficha.assinatura_url, null);
    return { resultado: r, assinaturas: sigs.map(x => ({ id: x.id, storagePath: x.assinatura_ref })), pendente: id(306), fichaNaoCarimbada: true };
  });
  const prot = await h.login('PROTETICO'); await prot.page.goto(base + '/dashboard/protetico');
  await h.check('Protético só entrega próprio pedido; campo clínico/financeiro e reentrega recusados', async () => {
    const original = (await h.get('pedidos_protetico', id(701)))[0];
    const bad = await prot.client.from('pedidos_protetico').update({ observacao: 'Alteração indevida D2' }).eq('id', id(701)); assert.ok(bad.error);
    assert.deepEqual((await h.get('pedidos_protetico', id(701)))[0], original);
    const r = await h.action('PROTETICO', 'marcarPedidoEntregue', [id(701)], '/dashboard/protetico'); assert.ok(!r.error, r.error);
    const delivered = (await h.get('pedidos_protetico', id(701)))[0]; assert.equal(delivered.status, 'entregue'); assert.ok(delivered.entregue_em);
    const again = await h.action('PROTETICO', 'marcarPedidoEntregue', [id(701)], '/dashboard/protetico'); assert.match(again.error, /já foi marcado/);
    assert.deepEqual((await h.get('pedidos_protetico', id(701)))[0], delivered);
    return { pedido: id(701), recusaCampo: bad.error.code, entregueEm: delivered.entregue_em, repeticao: again.error };
  }, prot.page);
} finally { await h.finish(); }
