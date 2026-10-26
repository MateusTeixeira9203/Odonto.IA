import { start, id, name, patientName, prefix, assert } from './harness.mjs';

const h = await start(process.argv[2] === 'revisado' ? '00-preparo-revisado' : '00-preparo');
try {
  const roles = {};
  for (const role of ['ANA', 'SARA', 'BRUNO', 'ADMIN', 'PROTETICO']) {
    const s = await h.login(role); roles[role] = { id: s.id, clinica_id: s.clinica_id, role: s.role, cro: s.cro };
  }
  h.report.ids = { prefixo: prefix, roles, pacientes: [1, 2, 3, 4, ...Array.from({ length: 36 }, (_, i) => 5000 + i)].map(id), fichas: [101, 102, 103, 104, 105, 106, 107].map(id), eventos: [301, 302, 303, ...Array.from({ length: 60 }, (_, i) => 1000 + i)].map(id), orcamentos: [601, 602].map(id), agenda: [201, 202].map(id), pedido: id(701) };
  h.save();
  await h.check('Preflight identidades e schema efetivo; fixture nova sem colisão', async () => {
    assert.notEqual(roles.ANA.clinica_id, roles.BRUNO.clinica_id);
    assert.equal(roles.SARA.clinica_id, roles.ANA.clinica_id);
    assert.equal((await h.get('pacientes', id(1))).length, 0);
    const meta = await h.pgRun(async pg => {
      const tables = await pg.query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name = any($1::text[]) order by table_name,ordinal_position", [['pedidos_protetico', 'agendamentos', 'prontuario_exclusoes_copias']]);
      const funcs = await pg.query("select p.proname, pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($1::text[])", [['assinar_procedimentos', 'excluir_ficha_clinica', 'salvar_eventos_odontograma']]);
      return { columns: tables.rows, functions: funcs.rows };
    });
    h.report.metadata = meta; return { identidades: roles, metadados: true };
  });
  if (h.report.casos.some(c => c.resultado === 'FALHOU')) throw new Error('Preflight falhou; seed não executado');
  await h.check('Seed transacional próprio, IDs exatos, sem tabelas/faixas de terceiros', async () => {
    const A = roles.ANA, B = roles.BRUNO, admin = roles.ADMIN;
    await h.pgRun(async pg => {
      await pg.query('begin');
      try {
        for (const [n, owner] of [[1, A], [2, B], [3, A], [4, A], ...Array.from({ length: 36 }, (_, i) => [5000 + i, A])]) {
          await pg.query('insert into public.pacientes(id,clinica_id,dentista_id,nome) values($1,$2,$3,$4)', [id(n), owner.clinica_id, owner.id, n === 1 ? name : patientName(n)]);
        }
        for (const n of [101, 102, 103, 104, 105, 106, 107]) {
          await pg.query("insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,queixa_principal,anotacoes) values($1,$2,$3,$4,$5,'manual','aberta','2026-10-25','QA-D2-QUEIXA-PRIVADA','QA-D2-CLINICO-PRIVADO')", [id(n), A.clinica_id, id(1), A.id, `QA D2 Ficha ${n}`]);
        }
        for (const [n, ficha, status] of [[301, 101, 'realizado'], [302, 104, 'realizado'], [303, 106, 'indicado'], ...Array.from({ length: 60 }, (_, i) => [1000 + i, 105, i % 2 ? 'indicado' : 'realizado'])]) {
          await pg.query("insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em) values($1,$2,$3,$4,$5,'profilaxia',$6,'clinica','boca','{}','sessao_atual',$7,$8)", [id(n), A.clinica_id, id(1), id(ficha), A.id, status, `QA D2 Procedimento ${n}`, status === 'realizado' ? '2026-10-25' : null]);
        }
        for (let i = 0; i < 35; i++) await pg.query("insert into public.ficha_evolucoes(id,clinica_id,ficha_id,dentista_id,data,texto,automatica) values($1,$2,$3,$4,'2026-10-25',$5,false)", [id(2000 + i), A.clinica_id, id(105), A.id, `QA D2 Evolução ${i}: acompanhamento sintético sem dado real.`]);
        for (const [n, ficha, owner] of [[601, 102, A], [602, 103, admin]]) {
          await pg.query("insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,total,aprovado_em) values($1,$2,$3,$4,$5,'aprovado',100,'2026-10-25T15:00:00Z')", [id(n), A.clinica_id, id(1), owner.id, id(ficha)]);
          await pg.query('insert into public.orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado) values($1,$2,$3,$4,1,100,100,true)', [id(n + 200), A.clinica_id, id(n), 'QA D2 Item Fictício']);
          await pg.query('insert into public.orcamento_cobrancas(id,clinica_id,orcamento_id,paciente_id,dentista_id,subtotal,valor_final) values($1,$2,$3,$4,$5,100,100)', [id(n + 300), A.clinica_id, id(n), id(1), owner.id]);
          await pg.query('insert into public.orcamento_cobranca_itens(cobranca_id,orcamento_item_id,clinica_id,preco_total_snapshot) values($1,$2,$3,100)', [id(n + 300), id(n + 200), A.clinica_id]);
          await pg.query("insert into public.pagamentos(id,clinica_id,orcamento_id,cobranca_id,paciente_id,dentista_id,valor,status,data_vencimento) values($1,$2,$3,$4,$5,$6,100,'pendente','2026-11-01')", [id(n + 400), A.clinica_id, id(n), id(n + 300), id(1), owner.id]);
        }
        await pg.query("insert into public.assinaturas(id,clinica_id,paciente_id,dentista_id,tipo,orcamento_id,assinado_por,cro_no_ato,assinatura_ref) values($1,$2,$3,$4,'orcamento',$5,$6,'QA-CRO-D2',$7)", [id(1101), A.clinica_id, id(1), A.id, id(601), name, `qa/${prefix}/sem-binario.png`]);
        for (const [n, owner, pat] of [[201, A, 3], [202, B, 2]]) await pg.query("insert into public.agendamentos(id,clinica_id,dentista_id,paciente_id,data_hora,duracao_minutos,status,observacoes) values($1,$2,$3,$4,'2026-11-16T13:00:00Z',30,'scheduled','QA D2 Campanha Agenda')", [id(n), owner.clinica_id, owner.id, id(pat)]);
        await pg.query("insert into public.pedidos_protetico(id,clinica_id,dentista_id,protetico_id,paciente_id,observacao,status,data_entrega) values($1,$2,$3,$4,$5,'QA D2 Pedido Sintético','pendente','2026-11-16')", [id(701), A.clinica_id, A.id, roles.PROTETICO.id, id(1)]);
        await pg.query('commit');
      } catch (e) { await pg.query('rollback'); throw e; }
    });
    return { manifesto: h.report.ids, estado: await h.ownState() };
  });
} catch (e) { h.report.limites.push(e.message); process.exitCode = 1; }
finally { await h.finish(); }
