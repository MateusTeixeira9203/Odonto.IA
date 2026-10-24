import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { OdontogramaEventoDraft } from '@/types/odontograma';
import * as v2 from './documento-atendimento';

test('c3: dúvida continua como relato no reconhecimento local, inclusive interrogação', () => {
  for (const texto of ['Talvez extração no dente 18.', 'Avaliar extração no dente 18.', 'Dúvida: extração no dente 18.', 'Extração no dente 18?', 'Realizei extração no dente 18?']) {
    assert.deepEqual(v2.reconhecerDocumento(texto, []).sugestoes, [], texto);
  }
  assert.equal(v2.reconhecerDocumento('Fiz extração no dente 18 sem intercorrências.', []).sugestoes[0].realizado, true);
  assert.deepEqual(v2.reconhecerDocumento('Não fiz extração no dente 18.', []).sugestoes, []);
  const misto = v2.reconhecerDocumento('Extração no dente 18? Canal no dente 26 MV 21mm.', []);
  assert.equal(misto.sugestoes.length, 1);
  assert.equal(misto.sugestoes[0].sugestao.tipo, 'endodontia');
  assert.deepEqual(misto.sugestoes[0].faces, []);
});

test('c3: remover e desfazer pendência preserva conteúdo, posição e modelo editado', () => {
  const pendente = v2.pendentesDeDenteInvalido('Realizei extração do dente 30.')[0];
  pendente.modelo.observacao = 'Observação fictícia';
  const doc: v2.DocumentoAtendimento = { ...v2.documentoVazio(), blocos: [pendente, ...v2.documentoVazio().blocos], pontoInsercao: pendente.id };
  const antes = structuredClone(doc);
  const resultado = v2.removerPendente(doc, pendente.id);
  assert.ok(resultado.removido);
  assert.equal(resultado.doc.blocos.length, 1);
  assert.equal(resultado.doc.blocos[0].tipo, 'texto');
  const restaurado = v2.restaurarPendente(resultado.doc, resultado.removido);
  assert.deepEqual(restaurado.blocos, antes.blocos);
  assert.equal(v2.restaurarPendente(restaurado, resultado.removido), restaurado);
  assert.deepEqual(doc, antes);
});
import { acrescentarTexto, documentoVazio, semNovasDuplicatas, textoParaSalvar, LIMITE_TEXTO_SALVAR, chaveRascunho, serializarRascunho, lerRascunho, type DocumentoAtendimento, type RascunhoAtendimento } from './documento-atendimento';

const id = (numero: number) => `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`;
function evento(numero: number, alteracoes: Partial<OdontogramaEventoDraft> = {}): OdontogramaEventoDraft {
  return {
    id: id(numero), tipo: 'carie_restauracao', status: 'indicado', origem: 'clinica',
    momento_planejado: 'sessao_atual', ancora: { nivel: 'face', dente: 26, faces: ['M', 'O', 'D'] },
    grupo_id: null, papel_no_grupo: null, observacao: '', realizado_em: null, ...alteracoes,
  };
}
function rascunhoLegado() {
  return {
    documento: { versao: 1 as const, idsNaFicha: [] as string[], blocos: [
      { id: 'texto-1', tipo: 'texto' as const, texto: ' Relato fictício\n', origem: 'documento' as const, organizado: false },
      { id: 'tabela-1', tipo: 'tabela' as const, especialidade: 'endodontia' as const, eventoId: id(1) },
      { id: 'texto-2', tipo: 'texto' as const, texto: '', origem: 'digitado' as const, organizado: false },
    ] },
    eventosDraft: [evento(1, {
      tipo: 'endodontia', ancora: { nivel: 'dente', dente: 46 }, observacao: ' Nota fictícia ',
      procedimentoNome: ' Tratamento endodôntico ', fonteFluxo: 'novo', chaveCaptura: 'captura-sintetica',
      revisar_status: true, evidencia_status: 'ambiguo', encaminhadoParaId: id(2),
      registrado_em: '2026-10-23', created_at: '2026-10-23T12:00:00Z', assinaturaId: null,
      autorDentistaId: id(3), dataIntencao: '2026-10-23',
      detalhe: { canais: [{ nome: 'MV', comprimentoRaiz: 21, referencia: null, limaInicial: null, limaFinal: null }], obturacao: null, cimento: null },
      endo_revisao: { origemPorCampo: { 'MV.raiz': 'manual' }, duvidas: [{ campo: 'MV.raiz', trecho: '21mm', motivo: 'conflito' }] },
    })],
    textoVisita: ' Evolução fictícia ',
    orto: { arcada: 'superior', fio: null, ativacao: null, elastico_corrente: null, elastico_intermaxilar: null, registro_superior: ' Registro fictício ' },
    alerta: ' Alerta fictício ', visitaKey: id(4),
  };
}

function rascunho(): RascunhoAtendimento {
  const resultado = lerRascunho(JSON.stringify(rascunhoLegado()));
  assert.ok(resultado.ok);
  return resultado.rascunho;
}

test('v2 1: inserir em qualquer ponto, editar, navegar e apagar só texto vazio', () => {
  const inicial = v2.documentoVazio();
  const primeiro = v2.acrescentarTexto(inicial, 'Relato fictício', 'digitado');
  const antes = v2.inserirTextoEm(primeiro, 'inicio');
  const depois = v2.inserirTextoEm(antes.doc, { depoisDe: primeiro.blocos[0].id });
  const meio = v2.inserirTextoEm(depois.doc, { antesDe: depois.id });
  const fim = v2.inserirTextoEm(meio.doc, 'fim');
  assert.deepEqual(fim.doc.blocos.map((b) => b.id), [antes.id, 'texto-1', meio.id, depois.id, fim.id]);
  assert.equal(v2.vizinho(fim.doc, meio.id, 'acima'), 'texto-1');
  assert.equal(v2.vizinho(fim.doc, meio.id, 'abaixo'), depois.id);
  assert.equal(v2.vizinho(fim.doc, antes.id, 'acima'), null);
  assert.equal(v2.vizinho(fim.doc, 'inexistente', 'abaixo'), null);
  assert.deepEqual(v2.apagarSeVazio(fim.doc, 'texto-1'), fim.doc);
  assert.equal(v2.apagarSeVazio(fim.doc, meio.id).blocos.some((b) => b.id === meio.id), false);
  const foco = v2.definirPontoInsercao(fim.doc, antes.id);
  const anexo = v2.acrescentarTexto(foco, 'Documento fictício', 'documento');
  assert.equal(v2.relatoParaDex(anexo)?.modo, 'exame_inicial');
  assert.equal(v2.temConteudo(inicial), false);
  assert.equal(v2.temConteudo(anexo), true);
  assert.deepEqual(inicial, v2.documentoVazio());
});

test('v2 2: eventos entram no ponto de inserção em ordem e órfãos saem', () => {
  const inicial = v2.acrescentarTexto(v2.documentoVazio(), 'Antes', 'digitado');
  const fim = v2.inserirTextoEm(inicial, 'fim');
  const doc = v2.definirPontoInsercao(fim.doc, inicial.blocos[0].id);
  const sincronizado = v2.sincronizarEventos(doc, [evento(2), evento(1)]);
  assert.deepEqual(sincronizado.blocos.map((b) => b.tipo), ['texto', 'procedimento', 'procedimento', 'texto']);
  assert.deepEqual(sincronizado.blocos.flatMap((b) => b.tipo === 'procedimento' ? [b.eventoId] : []), [id(2), id(1)]);
  const removido = v2.sincronizarEventos(sincronizado, [evento(1)]);
  assert.equal(removido.blocos.filter((b) => b.tipo === 'procedimento').length, 1);
  assert.deepEqual(v2.sincronizarEventos(removido, [evento(1)]), removido);
  assert.equal(removido.blocos.at(-1)?.tipo, 'texto');
});

test('v2 3: uma organização por rodada, observações uma vez e apenas texto novo no Dex', () => {
  const primeiro = v2.acrescentarTexto(v2.documentoVazio(), 'Primeiro', 'digitado');
  const segundo = v2.inserirTextoEm(primeiro, 'fim');
  const doc = v2.editarTexto(segundo.doc, segundo.id, 'Segundo');
  const relato = v2.relatoParaDex(doc);
  assert.ok(relato);
  const pendentes = v2.pendentesDeDenteInvalido('Realizei extração do dente 30.');
  const organizado = v2.aplicarOrganizacao(doc, { idsEnviados: relato.idsBlocos, textoEnviado: relato.texto, eventosNovosEmOrdem: [evento(2), evento(1)], pendentes });
  assert.deepEqual(organizado.blocos.map((b) => b.tipo), ['organizado', 'observacoes', 'procedimento', 'procedimento', 'pendente', 'texto']);
  assert.equal(organizado.blocos[0].tipo === 'organizado' && organizado.blocos[0].texto, 'Primeiro\n\nSegundo');
  assert.deepEqual(organizado.blocos.flatMap((b) => b.tipo === 'procedimento' ? [b.eventoId] : []), [id(2), id(1)]);
  assert.equal(v2.relatoParaDex(organizado), null);
  const novo = v2.acrescentarTexto(organizado, 'Só o novo', 'voz');
  const relatoNovo = v2.relatoParaDex(novo);
  assert.ok(relatoNovo);
  assert.equal(relatoNovo.texto, 'Só o novo');
  const rodada2 = v2.aplicarOrganizacao(novo, { idsEnviados: relatoNovo.idsBlocos, textoEnviado: relatoNovo.texto, eventosNovosEmOrdem: [evento(3)], pendentes: [] });
  assert.equal(rodada2.blocos.filter((b) => b.tipo === 'organizado').length, 2);
  assert.equal(rodada2.blocos.filter((b) => b.tipo === 'observacoes').length, 1);
  const alterado = v2.editarTexto(doc, segundo.id, 'Editado durante a chamada');
  const tardio = v2.aplicarOrganizacao(alterado, { idsEnviados: relato.idsBlocos, textoEnviado: relato.texto, eventosNovosEmOrdem: [], pendentes: [], blocosEnviados: [{ id: 'texto-1', texto: 'Primeiro' }, { id: segundo.id, texto: 'Segundo' }] });
  assert.equal(v2.relatoParaDex(tardio)?.texto, 'Editado durante a chamada');
  assert.equal(v2.relatoParaDex(v2.aplicarOrganizacao(alterado, { idsEnviados: relato.idsBlocos, textoEnviado: relato.texto, eventosNovosEmOrdem: [], pendentes: [] }))?.texto, 'Primeiro\n\nEditado durante a chamada');
});

test('v2 4: exemplo v8 gera só Extração 30 realizada; idade e medidas não são dentes', () => {
  const texto = 'Paciente relatou dor ao mastigar do lado esquerdo há uma semana. Realizei extração do dente 30. Encontrei restaurações para fazer no dente 35 MOD. Também encontrei dois canais, no dente 26 e no dente 32. Fiz limpeza.';
  const pendentes = v2.pendentesDeDenteInvalido(texto);
  assert.equal(pendentes.length, 1);
  assert.equal(pendentes[0].numeroInformado, '30');
  assert.equal(pendentes[0].modelo.tipo, 'exodontia');
  assert.equal(pendentes[0].modelo.procedimentoNome, 'Extração');
  assert.equal(pendentes[0].modelo.situacao, 'realizado');
  assert.deepEqual(v2.pendentesDeDenteInvalido('Paciente de 34 anos. Canal MV 21mm. Restauração dente 30mm.'), []);
  assert.deepEqual(v2.pendentesDeDenteInvalido('Não fazer extração do dente 30.'), []);
  assert.deepEqual(v2.pendentesDeDenteInvalido('Dor no dente 30.'), []);
  assert.deepEqual(v2.pendentesDeDenteInvalido('Extração do dente 55. Restauração dente 75 MOD.'), []);
  const indicado = v2.pendentesDeDenteInvalido('Extração do dente 30.');
  assert.equal(indicado[0].modelo.situacao, 'sessao_atual');
  for (const verbo of ['Fiz', 'Executei', 'Extraí', 'Foi feita']) {
    assert.equal(v2.pendentesDeDenteInvalido(`${verbo} extração do dente 30.`)[0].modelo.situacao, 'realizado');
  }
  assert.deepEqual(v2.pendentesDeDenteInvalido('Canal d 30 MOD.')[0].modelo.faces, ['M', 'O', 'D']);
  assert.deepEqual(v2.pendentesDeDenteInvalido('Implante dente 30 VL.')[0].modelo.faces, ['V', 'L']);
});

test('v2 5: resolver exige FDI válido, cria só uma vez e substitui na mesma posição', () => {
  const pendente = v2.pendentesDeDenteInvalido('Realizei extração do dente 30.')[0];
  const doc: DocumentoAtendimento = { ...v2.documentoVazio(), blocos: [pendente, ...v2.documentoVazio().blocos] };
  let chamadas = 0;
  const criar = (modelo: typeof pendente.modelo, dente: number) => {
    chamadas++;
    modelo.faces.push('M');
    return evento(1, { tipo: modelo.tipo, ancora: { nivel: 'dente', dente }, status: 'realizado', momento_planejado: 'sessao_atual' });
  };
  assert.deepEqual(v2.resolverPendente(doc, pendente.id, 19, criar), { doc, evento: null });
  assert.equal(chamadas, 0);
  const resolvido = v2.resolverPendente(doc, pendente.id, 36, criar);
  assert.equal(chamadas, 1);
  assert.equal(resolvido.doc.blocos[0].id, pendente.id);
  assert.equal(resolvido.doc.blocos[0].tipo, 'procedimento');
  assert.deepEqual(resolvido.evento?.ancora, { nivel: 'dente', dente: 36 });
  assert.deepEqual(pendente.modelo.faces, []);
  assert.equal(v2.resolverPendente(resolvido.doc, pendente.id, 36, criar).evento, null);
  assert.equal(chamadas, 1);
});

test('v2 6: salvar inclui pendentes legíveis e mede sem cortar em 5000 caracteres', () => {
  const pendente = v2.pendentesDeDenteInvalido('Realizei extração do dente 30.')[0];
  const doc: DocumentoAtendimento = { ...v2.documentoVazio(), blocos: [pendente, ...v2.documentoVazio().blocos] };
  const resultado = v2.textoParaSalvar('Evolução fictícia', doc, false);
  assert.match(resultado.texto, /Extração — dente 30 informado, sem dente válido/);
  assert.match(resultado.texto, /Realizei extração do dente 30/);
  const longo = v2.textoParaSalvar('x'.repeat(5001), doc, true);
  assert.equal(longo.excede, true);
  assert.equal(longo.tamanho, longo.texto.length);
  assert.ok(longo.texto.startsWith('x'.repeat(5001)));
  assert.equal(v2.textoParaSalvar('x'.repeat(5000), v2.documentoVazio(), false).excede, false);
});

test('v2 7: lê v1 sem perder dados, converte tabelas e sincroniza eventos sem bloco', () => {
  const antigo = rascunhoLegado();
  antigo.eventosDraft.push(evento(2));
  antigo.documento.blocos[0] = { ...antigo.documento.blocos[0], organizado: true };
  antigo.documento.idsNaFicha = [id(2)];
  const leitura = v2.lerRascunho(JSON.stringify(antigo));
  assert.equal(leitura.ok, true);
  if (!leitura.ok) return;
  assert.deepEqual(leitura.rascunho.eventosDraft, antigo.eventosDraft);
  assert.equal(leitura.rascunho.textoVisita, antigo.textoVisita);
  assert.equal(leitura.rascunho.documento.versao, 2);
  assert.equal(leitura.rascunho.documento.blocos.filter((b) => b.tipo === 'observacoes').length, 1);
  const linhas = leitura.rascunho.documento.blocos.filter((b) => b.tipo === 'procedimento');
  assert.equal(linhas.find((b) => b.eventoId === id(1))?.tabelaAberta, true);
  assert.equal(linhas.find((b) => b.eventoId === id(2))?.origem, 'dex');
  assert.deepEqual(v2.lerRascunho(v2.serializarRascunho(leitura.rascunho)), leitura);
  assert.deepEqual(v2.lerRascunho('{inválido'), { ok: false });
  const repetido = { ...leitura.rascunho, documento: { ...leitura.rascunho.documento, blocos: [...leitura.rascunho.documento.blocos, linhas[0]] } };
  assert.deepEqual(v2.lerRascunho(JSON.stringify(repetido)), { ok: false });
});

test('v2 8: funções preservam os objetos recebidos e a dedup continua compartilhada', () => {
  const doc = v2.acrescentarTexto(v2.documentoVazio(), 'Texto original fictício', 'digitado');
  const antes = structuredClone(doc);
  Object.freeze(doc.blocos[0]);
  Object.freeze(doc.blocos);
  Object.freeze(doc);
  v2.editarTexto(doc, 'texto-1', 'Outro');
  v2.inserirTextoEm(doc, 'fim');
  v2.sincronizarEventos(doc, [evento(1)]);
  v2.aplicarOrganizacao(doc, { idsEnviados: ['texto-1'], textoEnviado: 'Texto original fictício', eventosNovosEmOrdem: [evento(1)], pendentes: [] });
  assert.deepEqual(doc, antes);
  const a = evento(1);
  const c = evento(2);
  assert.deepEqual(v2.semNovasDuplicatas([a], [c]), { eventos: [c], descartados: [] });
  assert.deepEqual(v2.semNovasDuplicatas([a], [a, c]), { eventos: [a], descartados: [c] });
});

test('5: dedup rejeita somente IDs novos equivalentes e sempre aceita edição do mesmo ID', () => {
  const anterior = evento(1);
  const duplicado = evento(2, { ancora: { nivel: 'face', dente: 26, faces: ['D', 'M', 'O'] } });
  const editado = { ...anterior, observacao: 'Edição fictícia' };
  const outrasFaces = evento(3, { ancora: { nivel: 'face', dente: 26, faces: ['M', 'O'] } });
  assert.deepEqual(semNovasDuplicatas([anterior], [editado, duplicado, outrasFaces]), {
    eventos: [editado, outrasFaces], descartados: [duplicado],
  });
  assert.deepEqual(semNovasDuplicatas([], [anterior, duplicado]), { eventos: [anterior], descartados: [duplicado] });
  const realizado = evento(4, { status: 'realizado', realizado_em: '2026-10-23' });
  assert.deepEqual(semNovasDuplicatas([anterior], [realizado]).eventos, [realizado]);
  const assinado = evento(5, { assinaturaId: id(6) });
  assert.deepEqual(semNovasDuplicatas([anterior], [assinado]).eventos, [assinado]);
});

test('6: limite de 5.000 calcula o texto inteiro, incluindo separador, sem truncar', () => {
  const doc = acrescentarTexto(documentoVazio(), 'b'.repeat(1500), 'documento');
  const texto = 'a'.repeat(4000);
  assert.equal(LIMITE_TEXTO_SALVAR, 5000);
  assert.deepEqual(textoParaSalvar(texto, doc, true), { texto: `${texto}\n\n${'b'.repeat(1500)}`, tamanho: 5502, excede: true });
  assert.deepEqual(textoParaSalvar(texto, doc, false), { texto, tamanho: 4000, excede: false });
  assert.equal(textoParaSalvar('a'.repeat(5000), documentoVazio(), true).excede, false);
  assert.equal(textoParaSalvar('a'.repeat(5001), documentoVazio(), false).excede, true);
  assert.equal(textoParaSalvar('', doc, true).tamanho, 1500);
});

test('rascunho v2: JSON/versão inválidos e identidades de armazenamento isoladas', () => {
  const valor = rascunho();
  assert.deepEqual(lerRascunho(serializarRascunho(valor)), { ok: true, rascunho: valor });
  for (const json of ['{', 'null', '{}', JSON.stringify({ ...valor, documento: { ...valor.documento, versao: 3 } })]) {
    assert.deepEqual(lerRascunho(json), { ok: false });
  }
  const ids = { clinicaId: 'clinica-qa', dentistaId: 'dentista-qa', pacienteId: 'paciente-qa', agendamentoId: 'agendamento-qa' };
  assert.equal(chaveRascunho(ids), 'odontoia:meu-dia:rascunho:v2:clinica-qa:dentista-qa:paciente-qa:agendamento-qa');
  for (const campo of Object.keys(ids) as Array<keyof typeof ids>) assert.notEqual(chaveRascunho({ ...ids, [campo]: 'outro' }), chaveRascunho(ids));
});

test('revisão: dedup preserva substituição, edição e remoção no mesmo lote', () => {
  const a = evento(1);
  const editado = evento(1, { ancora: { nivel: 'face', dente: 26, faces: ['M', 'O'] } });
  const c = evento(3);
  assert.deepEqual(semNovasDuplicatas([a], [editado, c]), { eventos: [editado, c], descartados: [] });
  assert.deepEqual(semNovasDuplicatas([a], [c]), { eventos: [c], descartados: [] });
});

test('revisão: rascunhos incompletos preservam campos ainda não prontos para salvar', () => {
  for (const alteracoes of [
    { tipo: 'outro' as const, procedimentoNome: null }, { observacao: 'x'.repeat(5001) },
    { procedimentoNome: '' }, { procedimentoNome: '   ' }, { id: 'id-local' },
    { procedimentoId: 'catalogo-local' }, { realizado_em: 'data em edição' },
  ]) {
    const valor = { ...rascunho(), eventosDraft: [evento(1, alteracoes)] };
    const leitura = lerRascunho(serializarRascunho(valor));
    assert.ok(leitura.ok);
    assert.deepEqual(leitura.rascunho.eventosDraft, valor.eventosDraft);
    assert.equal(leitura.rascunho.textoVisita, valor.textoVisita);
  }
});

test('revisão: evento inválido não apaga texto nem eventos válidos', () => {
  const valor = rascunho();
  for (const invalido of [{ ...evento(2), status: 'incorreto' }, { ...evento(2), revisar_status: 'incorreto' }, { ...evento(2), ancora: { nivel: 'face' } }, null]) {
    assert.deepEqual(lerRascunho(JSON.stringify({ ...valor, eventosDraft: [...valor.eventosDraft, invalido] })), { ok: true, rascunho: valor });
  }
});

test('revisão c1: negação só antes da ação; sem intercorrências não oculta a extração', () => {
  for (const trecho of ['Realizei extração do dente 30 sem intercorrências.', 'Realizei extração do dente 30, sem intercorrências.']) {
    const pendentes = v2.pendentesDeDenteInvalido(trecho);
    assert.equal(pendentes.length, 1);
    assert.equal(pendentes[0].modelo.situacao, 'realizado');
  }
  for (const trecho of ['Não fiz extração do dente 30.', 'Sem fazer extração do dente 30.']) assert.deepEqual(v2.pendentesDeDenteInvalido(trecho), []);
  assert.deepEqual(v2.pendentesDeDenteInvalido('Talvez fiz extração do dente 30?'), []);
});

test('revisão c1: recupera texto de bloco malformado e conserva vizinhos válidos', () => {
  const valor = rascunho();
  const blocos = [
    { id: 'antes', tipo: 'texto', texto: 'Antes fictício', origem: 'digitado' },
    { id: 'novo-tipo', tipo: 'desconhecido', texto: 'Texto recuperado' },
    { id: 'sem-texto', tipo: 'texto', origem: 'digitado' },
    { id: 'depois', tipo: 'texto', texto: 'Depois fictício', origem: 'voz' },
  ];
  const ler = (lista: unknown[]) => lerRascunho(JSON.stringify({ ...valor, documento: { versao: 2, pontoInsercao: 'depois', blocos: lista } }));
  const leitura = ler(blocos);
  assert.ok(leitura.ok);
  assert.equal(v2.relatoParaDex(leitura.rascunho.documento)?.texto, 'Antes fictício\n\nTexto recuperado\n\nDepois fictício');
  assert.deepEqual(ler([...blocos, blocos[1]]), { ok: false });
  assert.deepEqual(ler([...blocos, { id: 'obs1', tipo: 'observacoes' }, { id: 'obs2', tipo: 'observacoes' }]), { ok: false });
  const linha = valor.documento.blocos.find((b) => b.tipo === 'procedimento');
  assert.ok(linha);
  assert.deepEqual(ler([...blocos, linha, { ...linha, id: 'outra-linha' }]), { ok: false });
});

test('revisão c1: evento ocupa texto vazio e mantém só um cursor de baixo', () => {
  const inicial = v2.documentoVazio();
  const sincronizado = v2.sincronizarEventos(inicial, [evento(1)]);
  assert.deepEqual(sincronizado.blocos.map((b) => b.tipo), ['procedimento', 'texto']);
  assert.equal(sincronizado.pontoInsercao, inicial.pontoInsercao);
  const segundo = v2.sincronizarEventos(sincronizado, [evento(1), evento(2)]);
  assert.deepEqual(segundo.blocos.map((b) => b.tipo), ['procedimento', 'procedimento', 'texto']);
});

test('revisão c1: remover o ponto de inserção cai no anterior, sem reciclar IDs', () => {
  const texto = v2.acrescentarTexto(v2.documentoVazio(), 'Antes', 'digitado');
  const doc = v2.sincronizarEventos(texto, [evento(1), evento(2)]);
  const linha = doc.blocos.find((b) => b.tipo === 'procedimento' && b.eventoId === id(1));
  assert.ok(linha);
  const foco = v2.definirPontoInsercao(doc, linha.id);
  const novo = v2.sincronizarEventos(foco, [evento(2), evento(3)]);
  assert.deepEqual(novo.blocos.flatMap((b) => b.tipo === 'procedimento' ? [b.eventoId] : []), [id(3), id(2)]);
  assert.equal(novo.blocos.some((b) => b.id === linha.id), false);
  const nenhum = v2.sincronizarEventos(novo, []);
  const outro = v2.sincronizarEventos(nenhum, [evento(4)]);
  assert.equal(outro.blocos.some((b) => b.tipo === 'procedimento' && doc.blocos.some((antes) => antes.id === b.id)), false);
});

test('c2: faces da mesma captura viram uma linha; capturas, dentes e intenções distintas permanecem', () => {
  const faces = ['M', 'O', 'D'] as const;
  const lote = faces.map((face, indice) => evento(indice + 1, { chaveCaptura: `captura:carie_restauracao:26:${face}`, ancora: { nivel: 'face', dente: 26, faces: [face] } }));
  const antes = structuredClone(lote);
  const unidos = v2.unirFacesDaCaptura([], lote);
  assert.equal(unidos.length, 1);
  assert.deepEqual(unidos[0].ancora.faces, ['M', 'O', 'D']);
  assert.deepEqual(lote, antes);
  assert.equal(v2.unirFacesDaCaptura([lote[0]], lote).length, 2);
  for (const alteracao of [{ chaveCaptura: 'outra:26:D' }, { status: 'realizado' as const }, { ancora: { nivel: 'face' as const, dente: 36, faces: ['D' as const] } }, { observacao: 'Outra intenção' }]) {
    assert.equal(v2.unirFacesDaCaptura([], [lote[0], { ...lote[1], ...alteracao }]).length, 2);
  }
  const repetidos = v2.unirFacesDaCaptura(unidos, [...unidos, ...lote.map((e, i) => ({ ...e, id: id(10 + i), chaveCaptura: e.chaveCaptura?.replace('captura:', 'repetida:') }))]);
  assert.equal(v2.semNovasDuplicatas(unidos, repetidos).descartados.length, 1);
});

test('d: dúvida em dente inválido permanece no relato com aviso, sem criar pendência', () => {
  for (const texto of ['Talvez extração no dente 30.', 'Extração no dente 30?', 'Avaliar extração no dente 30.', 'Dúvida: extração no dente 30.']) {
    assert.deepEqual(v2.pendentesDeDenteInvalido(texto), []);
    const reconhecimento = v2.reconhecerDocumento(texto, []);
    assert.deepEqual(reconhecimento.pendentes, []);
    assert.deepEqual(reconhecimento.sugestoes, []);
    assert.ok(reconhecimento.avisos.some((aviso) => aviso.includes('30')));
  }
});
