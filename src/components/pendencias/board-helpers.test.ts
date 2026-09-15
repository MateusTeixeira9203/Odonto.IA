import test from 'node:test';
import assert from 'node:assert/strict';
import { clinicInputDatetime, contactDate, filterContacts, safeWhatsappUrl } from './board-helpers';
import type { PendenciaCard } from '@/server/pendencias/contracts';
const card: PendenciaCard = {
  id:'a',tipo:'confirmar_presenca',status:'a_contatar',pacienteId:'p',pacienteNome:'João Ávila',temTelefone:true,dentistaId:'d',dentistaNome:'Ana',agendamentoId:'g',dataHora:'2026-09-15T19:00:00Z',duracaoMinutos:45,ultimaVisitaEm:null,responsavelUsuarioId:'u',envioConfirmado:false,adiadoAte:null,resolucao:null,versao:1,mensagem:'Olá',capabilities:{podeAbrirWhatsApp:true,podeGerirAcompanhamento:true,podeRegistrarEnvio:true,podeConfirmarAgenda:true,podeCancelarAgenda:true,podeConcluirAgendamento:true},
};
test('busca encontra nome com ou sem acentos e respeita motivo',()=>{
 assert.equal(filterContacts([card],'todos','joao avila').length,1);
 assert.equal(filterContacts([card],'reativar_paciente','joao').length,0);
});
test('data de confirmação usa BRT independentemente do timezone do processo',()=>{
 assert.equal(contactDate(card,new Date('2026-09-15T01:00:00Z')),'Amanhã, 16:00');
});
test('dias de reativação são civis, sem arredondamento pelo horário UTC',()=>{
 assert.equal(contactDate({...card,dataHora:null,ultimaVisitaEm:'2026-08-15'},new Date('2026-09-15T01:00:00Z')),'Há 30 dias sem atendimento');
});
test('links externos são limitados ao WhatsApp HTTPS com número',()=>{
 assert.equal(safeWhatsappUrl('https://wa.me/5534999999999?text=Oi'),true);
 for(const url of ['javascript:alert(1)','https://wa.me.evil.test/5534999999999','https://wa.me@evil.test/5534999999999','http://wa.me/5534999999999','https://wa.me/abc'])assert.equal(safeWhatsappUrl(url),false);
});
test('input da clínica produz instante UTC e rejeita formato inválido',()=>{
 assert.equal(clinicInputDatetime('2026-09-15T16:00'),'2026-09-15T19:00:00.000Z');
 assert.equal(clinicInputDatetime('2026-02-30T16:00'),null);
 assert.equal(clinicInputDatetime('2026-09-15T99:99'),null);
});
