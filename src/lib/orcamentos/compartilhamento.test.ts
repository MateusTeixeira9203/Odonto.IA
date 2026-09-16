import assert from 'node:assert/strict';
import test from 'node:test';
import { linkWhatsApp, mensagemOrcamento, telefoneWhatsApp } from './compartilhamento';
import { montarDocumentoPdf } from './documento-pdf';
import type { OrcamentoHtmlData } from '../prontuario-html';

const id='11111111-1111-4111-8111-111111111111';
export const documentFixture: OrcamentoHtmlData & { clinica: { nome: string } } = {
  id, created_at:'2026-09-15T12:00:00Z',status:'rascunho',total:30000,valor_acordado:null,desconto:0,
  cobrancas:[{desconto:1000,situacao:'aberta'}],validade_dias:30,condicoes_pagamento:'Superior e inferior em duas etapas.',
  mostrar_valor_por_item:false,paciente:{nome:'Paciente QA',telefone:'11999999999'},dentista:{nome:'Dentista QA'},clinica:{nome:'Clínica QA'},
  itens:[{descricao:'Arcada superior',quantidade:1,preco_unitario:15000,preco_total:15000,aprovado:true,
    composicao:[{descricao:'Coroa 11',quantidade:1,procedimentoId:null,eventoIds:[id]},{descricao:'Coroa 12',quantidade:1,procedimentoId:null,eventoIds:[id]}]},
    {descricao:'Não aprovado',quantidade:1,preco_unitario:15000,preco_total:15000,aprovado:false}],
  pagamentos:[{valor:500,status:'cancelado',forma_pagamento:null,data_pagamento:null},{valor:1000,status:'pago',forma_pagamento:'pix',data_pagamento:'2026-09-15'}],
};

test('número brasileiro com DDD55 não perde prefixo e mensagem não expõe URL interna',()=>{
  assert.equal(telefoneWhatsApp('(55) 99999-9999'),'5555999999999');
  assert.equal(telefoneWhatsApp('+55 11 99999-9999'),'5511999999999');
  assert.equal(telefoneWhatsApp('123'),null);
});

test('telefone inválido nega e caracteres especiais ficam codificados',()=>{
  assert.equal(telefoneWhatsApp('123'),null);
  assert.equal(linkWhatsApp('123','Olá'),null);
  const link=linkWhatsApp('(11) 99999-9999','Olá? & teste #1');
  assert.ok(link);
  assert.equal(new URL(link).searchParams.get('text'),'Olá? & teste #1');
  assert.doesNotMatch(mensagemOrcamento('Ana'),/https?:|api\/|valor/);
});

test('PDF conserva grupo aprovado, valor fechado, ocultação e saldo canônico',()=>{
  const result=montarDocumentoPdf(documentFixture);
  assert.equal(result.procedimentos.length,1);
  assert.equal(result.procedimentos[0].total,15000);
  assert.equal(result.procedimentos[0].composicao?.length,2);
  assert.equal(result.mostrarValorPorItem,false);
  assert.equal(result.total,14000);
  assert.equal(result.totalPago,1000);
  assert.equal(result.totalPendente,0);
  assert.equal(result.forma_pagamento,documentFixture.condicoes_pagamento);
});
