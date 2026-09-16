-- Compartilhamento manual: documento privado, autorização viva e confirmação explícita.
set local lock_timeout='2s';
set local statement_timeout='30s';
create function private.ler_orcamento_compartilhavel(p_clinica uuid,p_orcamento uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare v_doc jsonb; v_dentista uuid; v_membro public.clinica_usuarios%rowtype; v_clinica uuid;
begin
 select active_clinica_id into v_clinica from public.users where id=auth.uid();
 if v_clinica is null or v_clinica is distinct from p_clinica then return null; end if;
 perform 1 from public.clinica_governanca where clinica_id=p_clinica for share;
 select * into v_membro from public.clinica_usuarios where clinica_id=p_clinica and usuario_id=auth.uid() and status='ativo' for share;
 if v_membro.id is null or v_membro.role not in ('admin','dentista','secretaria','gestor') then return null; end if;
 select active_clinica_id into v_clinica from public.users where id=auth.uid() for share;
 if v_clinica is distinct from p_clinica then return null; end if;
 perform 1 from public.clinica_acessos where clinica_id=p_clinica and membro_id=v_membro.id for share;
 select dentista_id into v_dentista from public.orcamentos where clinica_id=p_clinica and id=p_orcamento for update;
 if v_dentista is null then return null; end if;
 if not (
   (v_membro.role in ('dentista','admin') and exists(select 1 from public.dentistas d where d.id=v_dentista and d.clinica_id=p_clinica and d.user_id=auth.uid() and d.ativo and d.role in ('dentista','admin')))
   or exists(select 1 from public.clinica_governanca g where g.clinica_id=p_clinica and g.modelo_clinica='gerida' and g.responsavel_usuario_id=auth.uid())
   or (private.membro_tem_permissao_operacional(p_clinica,'orcamentos.ler',v_dentista) and private.membro_tem_permissao_operacional(p_clinica,'contatos.whatsapp',v_dentista))
 ) then return null; end if;
 perform 1 from public.orcamento_itens where clinica_id=p_clinica and orcamento_id=p_orcamento for share;
 perform 1 from public.orcamento_cobrancas where clinica_id=p_clinica and orcamento_id=p_orcamento for share;
 perform 1 from public.pagamentos where clinica_id=p_clinica and orcamento_id=p_orcamento for share;
 select jsonb_build_object(
   'id',o.id,'created_at',o.created_at,'status',o.status,'total',o.total,
   'valor_acordado',o.valor_acordado,'desconto',coalesce(o.desconto,0),
   'validade_dias',coalesce(o.validade_dias,30),'condicoes_pagamento',o.condicoes_pagamento,
   'mostrar_valor_por_item',coalesce(o.mostrar_valor_por_item,true),
   'paciente',jsonb_build_object('nome',p.nome,'telefone',p.telefone),
   'dentista',jsonb_build_object('nome',d.nome),
   'clinica',jsonb_build_object('nome',c.nome),
   'itens',coalesce((select jsonb_agg(jsonb_build_object('descricao',i.descricao,'quantidade',i.quantidade,
      'preco_unitario',i.preco_unitario,'preco_total',i.preco_total,'aprovado',i.aprovado,'composicao',i.composicao) order by i.id)
     from public.orcamento_itens i where i.clinica_id=p_clinica and i.orcamento_id=o.id and i.retirado_em is null),'[]'::jsonb),
   'cobrancas',coalesce((select jsonb_agg(jsonb_build_object('desconto',cb.desconto,'situacao',cb.situacao) order by cb.id)
     from public.orcamento_cobrancas cb where cb.clinica_id=p_clinica and cb.orcamento_id=o.id),'[]'::jsonb),
   'pagamentos',coalesce((select jsonb_agg(jsonb_build_object('valor',pg.valor,'status',pg.status,'forma_pagamento',pg.forma_pagamento,'data_pagamento',pg.data_pagamento) order by pg.id)
     from public.pagamentos pg where pg.clinica_id=p_clinica and pg.orcamento_id=o.id and pg.status<>'cancelado'),'[]'::jsonb)
 ) into v_doc from public.orcamentos o
 join public.pacientes p on p.id=o.paciente_id and p.clinica_id=o.clinica_id
 join public.dentistas d on d.id=o.dentista_id and d.clinica_id=o.clinica_id
 join public.clinicas c on c.id=o.clinica_id
 where o.id=p_orcamento and o.clinica_id=p_clinica;
 return case when v_doc is null then null else jsonb_build_object('documento',v_doc,'snapshot',encode(extensions.digest(v_doc::text,'sha256'),'hex')) end;
end; $$;
create function public.ler_orcamento_compartilhavel(p_clinica uuid,p_orcamento uuid)
returns jsonb language sql security invoker set search_path=pg_catalog,private as $$ select private.ler_orcamento_compartilhavel(p_clinica,p_orcamento) $$;

create table public.orcamento_envios_manuais (
 id uuid primary key default gen_random_uuid(),
 clinica_id uuid not null references public.clinicas(id) on delete restrict,
 orcamento_id uuid not null references public.orcamentos(id) on delete restrict,
 ator_usuario_id uuid not null references public.users(id) on delete restrict,
 snapshot text not null check(snapshot ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 unique(clinica_id,orcamento_id,ator_usuario_id,snapshot)
);
alter table public.orcamento_envios_manuais enable row level security;
revoke all on public.orcamento_envios_manuais from public,anon,authenticated;

create function private.confirmar_envio_orcamento_manual(p_clinica uuid,p_orcamento uuid,p_snapshot text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_leitura jsonb; v_id uuid; v_paciente uuid;
begin
 v_leitura:=private.ler_orcamento_compartilhavel(p_clinica,p_orcamento);
 if v_leitura is null then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO'); end if;
 if p_snapshot is null or v_leitura->>'snapshot'<>p_snapshot then return jsonb_build_object('ok',false,'codigo','CONFLITO'); end if;
 insert into public.orcamento_envios_manuais(clinica_id,orcamento_id,ator_usuario_id,snapshot)
 values(p_clinica,p_orcamento,auth.uid(),p_snapshot) on conflict do nothing returning id into v_id;
 if v_id is not null then
   update public.orcamentos set enviado_em=coalesce(enviado_em,now()) where id=p_orcamento and clinica_id=p_clinica returning paciente_id into v_paciente;
   insert into public.activity_logs(clinica_id,paciente_id,entity_type,entity_id,action,metadata)
   values(p_clinica,v_paciente,'orcamento',p_orcamento::text,'orcamento.enviado',jsonb_build_object('ator_usuario_id',auth.uid(),'snapshot',p_snapshot,'origem','confirmacao_manual_pdf'));
 end if;
 return jsonb_build_object('ok',true);
exception when others then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL');
end; $$;
create function public.confirmar_envio_orcamento_manual(p_clinica uuid,p_orcamento uuid,p_snapshot text)
returns jsonb language sql security invoker set search_path=pg_catalog,private as $$ select private.confirmar_envio_orcamento_manual(p_clinica,p_orcamento,p_snapshot) $$;
revoke all on function private.ler_orcamento_compartilhavel(uuid,uuid),public.ler_orcamento_compartilhavel(uuid,uuid),private.confirmar_envio_orcamento_manual(uuid,uuid,text),public.confirmar_envio_orcamento_manual(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.ler_orcamento_compartilhavel(uuid,uuid),public.ler_orcamento_compartilhavel(uuid,uuid),private.confirmar_envio_orcamento_manual(uuid,uuid,text),public.confirmar_envio_orcamento_manual(uuid,uuid,text) to authenticated;
