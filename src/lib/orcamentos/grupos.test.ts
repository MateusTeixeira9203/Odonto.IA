import assert from 'node:assert/strict';
import test from 'node:test';
import { criarGrupoNaMontagem, composicaoParaSalvar, composicaoGrupoSchema, observacaoAcordoSchema } from './grupos';
import type { NovoOrcItem } from '@/app/dashboard/pacientes/[id]/_components/types';
import { buildOrcamentoHTML, type OrcamentoHtmlData } from '@/lib/prontuario-html';

function item(n: number): NovoOrcItem {
  return { descricao: `Restauração — dente ${n}`, quantidade: 1, preco: '', procedimentoId: '',
    eventoIds: [`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`], origem: 'evento', selecionado: true };
}
test('Renato: dois grupos de 15 mil sem preços individuais preservam todos os eventos', () => {
  const originais = [item(11), item(12), item(31), item(32)];
  const superior = criarGrupoNaMontagem(originais, originais.slice(0,2), 'Arcada superior', '15.000,00');
  assert.ok(superior.itens);
  const inferior = criarGrupoNaMontagem(superior.itens, superior.itens.slice(1), 'Arcada inferior', '15.000,00');
  assert.ok(inferior.itens);
  assert.equal(inferior.itens.length, 2);
  assert.deepEqual(inferior.itens.flatMap((i) => i.eventoIds), originais.flatMap((i) => i.eventoIds));
  assert.ok(inferior.itens.every((i) => i.quantidade === 1 && i.preco === '15.000,00'));
  assert.deepEqual(inferior.itens.flatMap((i) => i.composicao ?? [i]), originais);
  const composicao = composicaoParaSalvar(inferior.itens[0]);
  assert.ok(composicaoGrupoSchema.safeParse(composicao).success);
  assert.ok(composicao?.every((i) => !('preco' in i)));
});
test('não agrupa fontes duplicadas, manuais não persistidas, item excluído ou grupo aninhado', () => {
  const a=item(11), b=item(12);
  for (const membro of [{...b,eventoIds:a.eventoIds},{...b,eventoIds:[]},{...b,selecionado:false},{...b,composicao:[a,b]}]) {
    const itens=[a,membro]; assert.ok(criarGrupoNaMontagem(itens,itens,'Superior','500').erro);
  }
  assert.ok(criarGrupoNaMontagem([a,b],[a,b],'','500').erro);
  assert.ok(criarGrupoNaMontagem([a,b],[a,b],'Superior','0').erro);
});
test('observação vazia é opcional, texto preserva acentos e quebra de linha, excedente é rejeitado', () => {
  assert.equal(observacaoAcordoSchema.parse('  Superior no início.\nInferior depois.  '),'Superior no início.\nInferior depois.');
  assert.ok(observacaoAcordoSchema.safeParse('').success);
  assert.ok(observacaoAcordoSchema.safeParse(undefined).success);
  assert.equal(observacaoAcordoSchema.safeParse('a'.repeat(2001)).success,false);
});
test('documento mostra composição aprovada e escapa texto sem fabricar preço para os componentes', () => {
  const orc: OrcamentoHtmlData = { id:'orc-test',created_at:'2026-09-09',status:'aprovado',total:30000,
    valor_acordado:null,desconto:0,validade_dias:30,condicoes_pagamento:null,mostrar_valor_por_item:false,
    paciente:{nome:'Teste',telefone:null},dentista:{nome:'Renato'},pagamentos:[],
    itens:[{descricao:'Arcada superior',quantidade:1,preco_total:15000,preco_unitario:15000,aprovado:true,
      composicao:[{descricao:'<script>alert(1)</script>',quantidade:1,procedimentoId:null,eventoIds:[]}]},
      {descricao:'Arcada inferior',quantidade:1,preco_total:15000,preco_unitario:15000,aprovado:false}] };
  const html=buildOrcamentoHTML(orc);
  assert.ok(html.includes('Arcada superior')); assert.ok(!html.includes('Arcada inferior'));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /class="orc-item-price">[^<]*15\.000/);
  assert.ok(html.includes('15.000')); assert.ok(!html.includes('30.000'));
});
