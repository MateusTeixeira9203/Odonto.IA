-- R163c: operações de recebimento por capacidade; sem reatribuir fatos existentes.
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create function private.financeiro_clinica_ativa()
returns uuid language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_clinica uuid; v_atual uuid; v_membro uuid;
begin
  if auth.uid() is null then return null; end if;
  select active_clinica_id into v_clinica from public.users where id=auth.uid();
  if v_clinica is null then return null; end if;
  perform 1 from public.clinica_governanca where clinica_id=v_clinica for share;
  select id into v_membro from public.clinica_usuarios
    where clinica_id=v_clinica and usuario_id=auth.uid() and status='ativo'
      and role in ('dentista','admin','secretaria','gestor') for share;
  if v_membro is null then return null; end if;
  select active_clinica_id into v_atual from public.users where id=auth.uid() for share;
  if v_atual is distinct from v_clinica then return null; end if;
  perform 1 from public.clinica_acessos where clinica_id=v_clinica and membro_id=v_membro for share;
  return v_clinica;
end; $$;

create function private.financeiro_pode_operar(p_clinica uuid,p_dentista uuid,p_permissao text)
returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
  select p_permissao in ('recebimentos.registrar','recebimentos.corrigir','recebimentos.estornar')
    and exists(select 1 from public.users u join public.clinica_usuarios m
      on m.usuario_id=u.id and m.clinica_id=u.active_clinica_id
      where u.id=auth.uid() and u.active_clinica_id=p_clinica and m.status='ativo'
        and m.role in ('admin','dentista','secretaria','gestor'))
    and exists(select 1 from public.dentistas d where d.id=p_dentista and d.clinica_id=p_clinica)
    and (
      exists(select 1 from public.dentistas d where d.id=p_dentista and d.clinica_id=p_clinica
        and d.user_id=auth.uid() and d.ativo and d.role in ('admin','dentista')
        and exists(select 1 from public.clinica_usuarios cm where cm.clinica_id=p_clinica
          and cm.usuario_id=auth.uid() and cm.status='ativo' and cm.role in ('admin','dentista')))
      or exists(select 1 from public.clinica_governanca g where g.clinica_id=p_clinica
        and g.modelo_clinica='gerida' and g.responsavel_usuario_id=auth.uid())
      or (private.membro_tem_permissao_operacional(p_clinica,p_permissao,p_dentista)
        and private.membro_tem_permissao_operacional(p_clinica,'cobrancas.ler',p_dentista))
    );
$$;
revoke all on function private.financeiro_clinica_ativa(),private.financeiro_pode_operar(uuid,uuid,text)
  from public,anon,authenticated;

-- Clones privados verificados das funções vigentes: mantém o corpo financeiro mais
-- recente (incluindo retirados/descontos), sem abrir as RPCs legadas a perfis novos.
-- As chamadas antigas continuam exigindo can_act_as_dentista; a expansão por
-- capacidade só passa pelo envelope idempotente abaixo.
do $patch$
declare v record; v_oid regprocedure; v_sql text; v_nome text;
begin
  for v in select * from (values
    ('registrar_recebimento_orcamento(uuid,numeric,text,date)','recebimentos.registrar'),
    ('registrar_recebimento_cobranca(uuid,numeric,text,date)','recebimentos.registrar'),
    ('confirmar_previsao_orcamento(uuid,text,date)','recebimentos.registrar'),
    ('corrigir_recebimento_orcamento(uuid,numeric,text,date)','recebimentos.corrigir'),
    ('estornar_recebimento_orcamento(uuid,text)','recebimentos.estornar')
  ) as f(assinatura,permissao) loop
    v_oid:=to_regprocedure('public.'||v.assinatura);
    if v_oid is null then raise exception 'r163c_funcao_ausente: %',v.assinatura; end if;
    v_sql:=pg_get_functiondef(v_oid);
    if position('v_clinica_id uuid := public.get_my_clinica_id();' in v_sql)=0
      or position('public.can_act_as_dentista(' in v_sql)=0
      or position('insert into public.activity_logs' in lower(v_sql))=0 then
      raise exception 'r163c_contrato_divergente: %',v.assinatura;
    end if;
    v_nome:=split_part(v.assinatura,'(',1);
    v_sql:=replace(v_sql,
      'CREATE OR REPLACE FUNCTION public.'||v_nome||'(',
      'CREATE OR REPLACE FUNCTION private.r163c_'||v_nome||'(');
    if position('CREATE OR REPLACE FUNCTION private.r163c_'||v_nome||'(' in v_sql)<>1 then
      raise exception 'r163c_assinatura_nao_mapeada: %',v.assinatura;
    end if;
    v_sql:=replace(v_sql,'v_clinica_id uuid := public.get_my_clinica_id();',
      'v_clinica_id uuid := private.financeiro_clinica_ativa();');
    v_sql:=replace(v_sql,'public.can_act_as_dentista(v_orc.dentista_id)',
      format('private.financeiro_pode_operar(v_clinica_id,v_orc.dentista_id,%L)',v.permissao));
    v_sql:=replace(v_sql,'public.can_act_as_dentista(v_cobranca.dentista_id)',
      format('private.financeiro_pode_operar(v_clinica_id,v_cobranca.dentista_id,%L)',v.permissao));
    if position('public.can_act_as_dentista(' in v_sql)>0
      or position('private.financeiro_pode_operar(' in v_sql)=0 then
      raise exception 'r163c_autorizacao_nao_mapeada: %',v.assinatura;
    end if;
    -- Somente perfil clínico real pode ocupar as FKs antigas de operador dentista.
    v_sql:=replace(v_sql,'v_actor_id uuid := public.get_my_dentista_id();',
      'v_actor_id uuid := (select d.id from public.dentistas d join public.clinica_usuarios m on m.clinica_id=d.clinica_id and m.usuario_id=d.user_id where d.user_id=auth.uid() and d.clinica_id=v_clinica_id and d.ativo and d.role in (''dentista'',''admin'') and m.status=''ativo'' and m.role in (''dentista'',''admin''));');
    v_sql:=regexp_replace(v_sql,'(''pagamento\.(registrado|editado|estornado)'',\s*jsonb_build_object\()',
      '\1''ator_usuario_id'',auth.uid(),','g');
    if position('''ator_usuario_id'',auth.uid()' in v_sql)=0 then raise exception 'r163c_auditoria_ausente'; end if;
    execute v_sql;
  end loop;
end; $patch$;

revoke all on function
  private.r163c_registrar_recebimento_orcamento(uuid,numeric,text,date),
  private.r163c_registrar_recebimento_cobranca(uuid,numeric,text,date),
  private.r163c_confirmar_previsao_orcamento(uuid,text,date),
  private.r163c_corrigir_recebimento_orcamento(uuid,numeric,text,date),
  private.r163c_estornar_recebimento_orcamento(uuid,text)
from public,anon,authenticated;

create table public.financeiro_operacoes_clinica (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  ator_usuario_id uuid not null references public.users(id) on delete restrict,
  chave_idempotencia uuid not null,
  acao text not null check (acao in ('registrar','confirmar','corrigir','estornar')),
  payload_hash text not null,
  resultado jsonb not null,
  created_at timestamptz not null default now(),
  unique(clinica_id,ator_usuario_id,chave_idempotencia)
);
alter table public.financeiro_operacoes_clinica enable row level security;
revoke all on public.financeiro_operacoes_clinica from public,anon,authenticated;
create function private.financeiro_operacao_imutavel() returns trigger
language plpgsql set search_path=pg_catalog as $$ begin raise exception 'operacao_financeira_imutavel'; end; $$;
create trigger financeiro_operacoes_append_only before update or delete on public.financeiro_operacoes_clinica
for each row execute function private.financeiro_operacao_imutavel();
revoke all on function private.financeiro_operacao_imutavel() from public,anon,authenticated;

create function private.operar_recebimento_clinica(p_clinica_id_esperada uuid,p_acao text,p_payload jsonb,p_chave_idempotencia uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare
 v_clinica uuid; v_orc public.orcamentos%rowtype; v_pag public.pagamentos%rowtype;
 v_cobranca public.orcamento_cobrancas%rowtype; v_id uuid; v_orc_id uuid;
 v_hash text; v_anterior public.financeiro_operacoes_clinica%rowtype; v_result jsonb;
 v_permissao text; v_valor numeric; v_data date; v_forma text;
begin
 v_clinica:=private.financeiro_clinica_ativa();
 if v_clinica is null then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Acesso financeiro indisponível.'); end if;
 if v_clinica is distinct from p_clinica_id_esperada then return jsonb_build_object('ok',false,'codigo','CONTEXTO_ALTERADO','mensagem','A clínica ativa mudou. Atualize a página.'); end if;
 if p_acao is null or p_acao not in ('registrar','confirmar','corrigir','estornar') or p_chave_idempotencia is null
   or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'r163c_invalido'; end if;
 if exists(select 1 from jsonb_each(p_payload) e where e.value='null'::jsonb or e.key <> all(
   case p_acao
     when 'registrar' then array['orcamentoId','cobrancaId','valorCentavos','formaPagamento','data']
     when 'confirmar' then array['pagamentoId','atualizadoEm','formaPagamento','data']
     when 'corrigir' then array['pagamentoId','atualizadoEm','formaPagamento','data','valorCentavos']
     else array['pagamentoId','atualizadoEm','motivo'] end)) then raise exception 'r163c_invalido'; end if;
 if exists(select 1 from jsonb_each(p_payload) e where jsonb_typeof(e.value) is distinct from
   case when e.key='valorCentavos' then 'number' else 'string' end) then raise exception 'r163c_invalido'; end if;
 v_permissao:=case p_acao when 'corrigir' then 'recebimentos.corrigir' when 'estornar' then 'recebimentos.estornar' else 'recebimentos.registrar' end;
 if p_acao='registrar' then
   if (p_payload->>'orcamentoId' is null) = (p_payload->>'cobrancaId' is null) then raise exception 'r163c_invalido'; end if;
   if p_payload->>'cobrancaId' is not null then
     select * into v_cobranca from public.orcamento_cobrancas where clinica_id=v_clinica and id=(p_payload->>'cobrancaId')::uuid;
     v_orc_id:=v_cobranca.orcamento_id;
   else v_orc_id:=(p_payload->>'orcamentoId')::uuid; end if;
 else
   select * into v_pag from public.pagamentos where clinica_id=v_clinica and id=(p_payload->>'pagamentoId')::uuid;
   v_orc_id:=v_pag.orcamento_id;
 end if;
 select * into v_orc from public.orcamentos where clinica_id=v_clinica and id=v_orc_id for update;
 if v_orc.id is null or private.financeiro_pode_operar(v_clinica,v_orc.dentista_id,v_permissao) is not true then
   return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem permissão para esta operação.'); end if;
 if v_pag.cobranca_id is not null or v_cobranca.id is not null then
   select * into v_cobranca from public.orcamento_cobrancas where clinica_id=v_clinica
     and orcamento_id=v_orc.id and id=coalesce(v_pag.cobranca_id,v_cobranca.id) for update;
   if v_cobranca.id is null then raise exception 'r163c_invalido'; end if;
 end if;
 if p_acao<>'registrar' then
   select * into v_pag from public.pagamentos where clinica_id=v_clinica and orcamento_id=v_orc.id and id=(p_payload->>'pagamentoId')::uuid for update;
   if v_pag.id is null then raise exception 'r163c_invalido'; end if;
 end if;
 -- Serializa também chaves usadas simultaneamente para orçamentos diferentes.
 perform pg_advisory_xact_lock(hashtextextended(v_clinica::text||auth.uid()::text||p_chave_idempotencia::text,0));
 v_hash:=encode(extensions.digest(p_acao||p_payload::text,'sha256'),'hex');
 select * into v_anterior from public.financeiro_operacoes_clinica
   where clinica_id=v_clinica and ator_usuario_id=auth.uid() and chave_idempotencia=p_chave_idempotencia;
 if v_anterior.id is not null then
   if v_anterior.payload_hash<>v_hash or v_anterior.acao<>p_acao then
     return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Esta operação já foi usada com outros dados.'); end if;
   return v_anterior.resultado;
 end if;
 if p_acao<>'registrar' and (p_payload->>'atualizadoEm' is null or v_pag.updated_at is distinct from (p_payload->>'atualizadoEm')::timestamptz) then
   return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','O recebimento mudou. Atualize antes de continuar.'); end if;
 if p_acao in ('registrar','corrigir') then
   v_valor:=(p_payload->>'valorCentavos')::numeric;
   if v_valor is null or v_valor<=0 or v_valor<>trunc(v_valor) or v_valor>999999999999 then raise exception 'r163c_invalido'; end if;
   v_valor:=v_valor/100;
 end if;
 if p_acao<>'estornar' then
   v_data:=(p_payload->>'data')::date; v_forma:=p_payload->>'formaPagamento';
   if v_data is null or to_char(v_data,'YYYY-MM-DD')<>p_payload->>'data'
      or v_forma not in ('dinheiro','pix','cartao_credito','cartao_debito','boleto','outro') then
     raise exception 'r163c_invalido';
   end if;
 elsif char_length(btrim(p_payload->>'motivo')) not between 1 and 500 then
   raise exception 'r163c_invalido';
 end if;
 if p_acao='registrar' and v_cobranca.id is not null then
   v_pag:=private.r163c_registrar_recebimento_cobranca(v_cobranca.id,v_valor,v_forma,v_data);
 elsif p_acao='registrar' then
   v_pag:=private.r163c_registrar_recebimento_orcamento(v_orc.id,v_valor,v_forma,v_data);
 elsif p_acao='confirmar' then
   v_pag:=private.r163c_confirmar_previsao_orcamento(v_pag.id,v_forma,v_data);
 elsif p_acao='corrigir' then
   v_pag:=private.r163c_corrigir_recebimento_orcamento(v_pag.id,v_valor,v_forma,v_data);
 else v_pag:=private.r163c_estornar_recebimento_orcamento(v_pag.id,p_payload->>'motivo'); end if;
 v_result:=jsonb_build_object('ok',true,'data',jsonb_build_object('pagamentoId',v_pag.id,'orcamentoId',v_pag.orcamento_id,
   'pacienteId',v_pag.paciente_id,'titular',v_pag.titular_recebimento,'valorCentavos',round(v_pag.valor*100),'status',v_pag.status,'atualizadoEm',v_pag.updated_at));
 insert into public.financeiro_operacoes_clinica(clinica_id,ator_usuario_id,chave_idempotencia,acao,payload_hash,resultado)
 values(v_clinica,auth.uid(),p_chave_idempotencia,p_acao,v_hash,v_result);
 return v_result;
exception
 when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
   return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Revise os dados da operação.');
 when others then
   if sqlerrm='valor_acima_do_saldo' then return jsonb_build_object('ok',false,'codigo','SALDO_EXCEDIDO','mensagem','O valor ultrapassa o saldo disponível.'); end if;
   if sqlerrm in ('r163c_invalido','valor_invalido','forma_invalida','data_invalida','motivo_invalido','orcamento_sem_aprovacao') then
     return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Revise valor, forma, data e situação da cobrança.'); end if;
   if sqlerrm='sem_permissao' then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem permissão para esta operação.'); end if;
   if sqlerrm in ('recebimento_indisponivel','previsao_indisponivel','cobranca_indisponivel') then
     return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','A cobrança mudou. Atualize a página.'); end if;
   return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível concluir. Tente novamente com os mesmos dados.');
end; $$;
create function public.operar_recebimento_clinica(p_clinica_id_esperada uuid,p_acao text,p_payload jsonb,p_chave_idempotencia uuid)
returns jsonb language sql security definer set search_path=pg_catalog,private as $$
 select private.operar_recebimento_clinica(p_clinica_id_esperada,p_acao,p_payload,p_chave_idempotencia);
$$;
revoke all on function private.operar_recebimento_clinica(uuid,text,jsonb,uuid),public.operar_recebimento_clinica(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.operar_recebimento_clinica(uuid,text,jsonb,uuid) to authenticated;
