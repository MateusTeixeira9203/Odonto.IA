/**
 * R-16 — testes da lógica de filtro por responsável. Roda sem framework:
 *   node --test src/lib/fichas/filtro-responsavel.test.ts
 * (Node ≥ 23 executa TypeScript nativo; import com extensão .ts é obrigatório.)
 *
 * Cobre os gates de aceite do R-16 na lógica pura — a única verificação possível
 * nesta sessão (a tela real é login-gated).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  responsavelPassaFiltro,
  derivarResponsaveis,
  eventosVisiveis,
  fichaVisivel,
  filtroAindaValido,
  FILTRO_MEUS,
  type RegistroResponsavel,
  type FichaResponsavel,
} from './filtro-responsavel.ts';

const EU = 'dent-eu';
const DRX = 'dent-x';
const DRY = 'dent-y';

const reg = (destino: { id: string; nome: string } | null): RegistroResponsavel => ({ encaminhadoPara: destino });
const regDoAutor = (autorId: string, autorNome: string): RegistroResponsavel => ({
  encaminhadoPara: null,
  autorId,
  autorNome,
});
const DRX_PESSOA = { id: DRX, nome: 'Dra. X' };

// Fichas de exemplo: minha ficha com 1 registro meu + 1 encaminhado à Dra. X.
const fichaMinhaMista: FichaResponsavel<RegistroResponsavel> = {
  autorId: EU, autorNome: 'Eu',
  eventos: [reg(null), reg(DRX_PESSOA)],
};
// Ficha da Dra. X, registros dela, nenhum encaminhado.
const fichaDaX: FichaResponsavel<RegistroResponsavel> = {
  autorId: DRX, autorNome: 'Dra. X',
  eventos: [reg(null)],
};

test('responsavelPassaFiltro: Todos (null) deixa qualquer um passar', () => {
  assert.equal(responsavelPassaFiltro(EU, null, EU), true);
  assert.equal(responsavelPassaFiltro(DRX, null, EU), true);
});

test('responsavelPassaFiltro: Meus só passa o dentista logado', () => {
  assert.equal(responsavelPassaFiltro(EU, FILTRO_MEUS, EU), true);
  assert.equal(responsavelPassaFiltro(DRX, FILTRO_MEUS, EU), false);
});

test('responsavelPassaFiltro: por dentista só passa aquele id', () => {
  assert.equal(responsavelPassaFiltro(DRX, DRX, EU), true);
  assert.equal(responsavelPassaFiltro(EU, DRX, EU), false);
});

test('derivarResponsaveis: solo (1 autor, sem encaminhar) → 1 responsável', () => {
  const r = derivarResponsaveis([{ autorId: EU, autorNome: 'Eu', eventos: [reg(null), reg(null)] }]);
  assert.deepEqual(r, [{ id: EU, nome: 'Eu' }]);
});

test('derivarResponsaveis: encaminhado conta pro DESTINO, não pro autor', () => {
  // Minha ficha, registro encaminhado à Dra. X → responsáveis = { eu, X }.
  const r = derivarResponsaveis([fichaMinhaMista]);
  assert.deepEqual(r.map((x) => x.id).sort(), [DRX, EU].sort());
});

test('derivarResponsaveis: dedup por id preservando ordem de 1ª ocorrência', () => {
  const r = derivarResponsaveis([fichaMinhaMista, fichaDaX]);
  // eu (1º evento), X (2º evento), depois fichaDaX repete X → sem duplicar.
  assert.deepEqual(r, [{ id: EU, nome: 'Eu' }, { id: DRX, nome: 'Dra. X' }]);
});

test('derivarResponsaveis: ficha sem eventos responde ao autor', () => {
  const r = derivarResponsaveis([{ autorId: DRY, autorNome: 'Dr. Y', eventos: [] }]);
  assert.deepEqual(r, [{ id: DRY, nome: 'Dr. Y' }]);
});

test('eventosVisiveis: Todos devolve a MESMA referência (sem trabalho)', () => {
  const evs = [reg(null), reg(DRX_PESSOA)];
  assert.equal(eventosVisiveis(evs, EU, null, EU), evs);
});

test('GATE: registro encaminhado à Dra. X some de "Meus" mesmo eu sendo o autor', () => {
  const vis = eventosVisiveis(fichaMinhaMista.eventos, EU, FILTRO_MEUS, EU);
  assert.equal(vis.length, 1);
  assert.equal(vis[0].encaminhadoPara, null); // sobrou só o não-encaminhado
});

test('GATE: registro encaminhado à Dra. X aparece no filtro "[Dra. X]"', () => {
  const vis = eventosVisiveis(fichaMinhaMista.eventos, EU, DRX, EU);
  assert.equal(vis.length, 1);
  assert.equal(vis[0].encaminhadoPara?.id, DRX);
});

test('GATE: procedimento novo do dentista que recebeu a ficha entra em "Meus"', () => {
  // A ficha foi criada por EU, mas a Dra. X recebeu um procedimento e registrou outro nela.
  // Sem autorId, o segundo era atribuído a EU e ficava fora do orçamento da Dra. X.
  const eventos = [reg(DRX_PESSOA), regDoAutor(DRX, 'Dra. X')];
  const vis = eventosVisiveis(eventos, EU, FILTRO_MEUS, DRX);
  assert.equal(vis.length, 2);
  assert.deepEqual(derivarResponsaveis([{ autorId: EU, autorNome: 'Eu', eventos }]), [{ id: DRX, nome: 'Dra. X' }]);
});

test('fichaVisivel: Todos → sempre visível', () => {
  assert.equal(fichaVisivel(fichaDaX, null, EU), true);
});

test('GATE: ficha só com registros de outro colapsa sob "Meus"', () => {
  assert.equal(fichaVisivel(fichaDaX, FILTRO_MEUS, EU), false);
});

test('GATE: ficha mista sobrevive sob "Meus" (tem ≥1 registro meu)', () => {
  assert.equal(fichaVisivel(fichaMinhaMista, FILTRO_MEUS, EU), true);
});

test('fichaVisivel: ficha sem eventos segue o autor', () => {
  const soTexto: FichaResponsavel<RegistroResponsavel> = { autorId: EU, autorNome: 'Eu', eventos: [] };
  assert.equal(fichaVisivel(soTexto, FILTRO_MEUS, EU), true);
  assert.equal(fichaVisivel(soTexto, DRX, EU), false);
});

test('filtroAindaValido: Todos (null) é sempre válido', () => {
  assert.equal(filtroAindaValido(null, [], EU), true);
  assert.equal(filtroAindaValido(null, [{ id: DRX }], EU), true);
});

test('filtroAindaValido: [Dr. X] válido enquanto ele estiver entre os responsáveis', () => {
  assert.equal(filtroAindaValido(DRX, [{ id: EU }, { id: DRX }], EU), true);
});

test('GATE R-18: [Dr. X] inválido quando ele some dos responsáveis (achado real, auditoria 24/07)', () => {
  // Cenário exato do bug: desfiz o único encaminhamento pra Dra. X enquanto o
  // filtro estava fixado nela — ela não é mais responsável por nada.
  assert.equal(filtroAindaValido(DRX, [{ id: EU }], EU), false);
});

test('filtroAindaValido: Meus válido só se EU ainda for responsável por algo', () => {
  assert.equal(filtroAindaValido(FILTRO_MEUS, [{ id: EU }, { id: DRX }], EU), true);
  assert.equal(filtroAindaValido(FILTRO_MEUS, [{ id: DRX }], EU), false);
});
