-- R-140e1: catálogo de ações de estoque. Não concede acessos nem ativa governança.
-- Preserva validação legada, grants e policies; somente soma três chaves e o teto 45.
-- Reversão do app mantém esta extensão compatível; não restaurar teto 42 com grants novos.
set local lock_timeout = '1500ms';
set local statement_timeout = '10s';

create or replace function private.normalizar_acessos(p_acessos jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_item jsonb;
  v_escopo jsonb;
  v_permissao text;
  v_tipo text;
  v_alvos jsonb;
  v_alvo_texto text;
  v_alvo uuid;
  v_permissoes text[] := array[]::text[];
  v_resultado jsonb := '[]'::jsonb;
begin
  if p_acessos is null
    or jsonb_typeof(p_acessos) <> 'array'
    or jsonb_array_length(p_acessos) > 45 then
    return null;
  end if;

  for v_item in select value from jsonb_array_elements(p_acessos)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or (select array_agg(key order by key) from jsonb_object_keys(v_item) as key)
           is distinct from array['escopo', 'permissao'] then
      return null;
    end if;

    if jsonb_typeof(v_item -> 'permissao') <> 'string'
      or jsonb_typeof(v_item -> 'escopo') <> 'object' then
      return null;
    end if;

    v_permissao := v_item ->> 'permissao';
    v_escopo := v_item -> 'escopo';
    v_tipo := v_escopo ->> 'tipo';

    if v_permissao = any(v_permissoes)
      or v_permissao not in (
        'pacientes.ler', 'pacientes.editar', 'agenda.ler', 'agenda.editar',
        'agenda.confirmar', 'contatos.whatsapp', 'acompanhamentos.ler',
        'acompanhamentos.gerir', 'clinico.ler', 'clinico.registrar',
        'orcamentos.ler', 'orcamentos.criar', 'orcamentos.aceite',
        'orcamentos.cancelar', 'precos.ler', 'precos.editar', 'precos.excecao',
        'descontos.solicitar', 'descontos.aprovar', 'cobrancas.ler',
        'cobrancas.gerir', 'recebimentos.registrar', 'recebimentos.corrigir',
        'recebimentos.estornar', 'financeiro.ler', 'financeiro.exportar',
        'despesas.ler', 'despesas.gerir', 'repasses.ler', 'repasses.gerir',
        'equipe.ler', 'equipe.convidar', 'equipe.remover', 'permissoes.gerir',
        'configuracoes.gerir', 'auditoria.ler', 'estoque.ler', 'estoque.gerir',
        'estoque.receber', 'estoque.consumir', 'estoque.descartar',
        'estoque.ajustar', 'kits.gerir', 'materiais.confirmar',
        'unidades.consolidar'
      ) then
      return null;
    end if;
    v_permissoes := array_append(v_permissoes, v_permissao);

    if v_tipo in ('nenhum', 'proprio', 'clinica') then
      if (select array_agg(key order by key) from jsonb_object_keys(v_escopo) as key)
           is distinct from array['tipo'] then
        return null;
      end if;
    elsif v_tipo = 'selecionados' then
      if (select array_agg(key order by key) from jsonb_object_keys(v_escopo) as key)
           is distinct from array['dentistaIds', 'tipo']
        or jsonb_typeof(v_escopo -> 'dentistaIds') <> 'array'
        or jsonb_array_length(v_escopo -> 'dentistaIds') not between 1 and 200 then
        return null;
      end if;

      v_alvos := '[]'::jsonb;
      for v_alvo_texto in select value from jsonb_array_elements_text(v_escopo -> 'dentistaIds')
      loop
        -- Espelha z.string().uuid(): forma canônica, versões RFC 1–8 e variante RFC.
        if v_alvo_texto is null
          or v_alvo_texto !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          return null;
        end if;
        v_alvo := lower(v_alvo_texto)::uuid;
        if v_alvos @> jsonb_build_array(to_jsonb(v_alvo::text)) then
          return null;
        end if;
        v_alvos := v_alvos || jsonb_build_array(to_jsonb(v_alvo::text));
      end loop;
      select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
        into v_alvos
      from jsonb_array_elements(v_alvos);
      v_escopo := jsonb_build_object('tipo', 'selecionados', 'dentistaIds', v_alvos);
    else
      return null;
    end if;

    if (v_permissao in ('pacientes.ler', 'pacientes.editar')
          and v_tipo not in ('nenhum', 'selecionados', 'clinica'))
      or (v_permissao = 'clinico.registrar' and v_tipo not in ('nenhum', 'proprio'))
      or (v_permissao in (
            'precos.ler', 'precos.editar', 'equipe.ler', 'equipe.convidar',
            'equipe.remover', 'permissoes.gerir', 'configuracoes.gerir',
            'auditoria.ler', 'unidades.consolidar'
          ) and v_tipo not in ('nenhum', 'clinica')) then
      return null;
    end if;

    v_resultado := v_resultado || jsonb_build_array(
      jsonb_build_object('permissao', v_permissao, 'escopo', v_escopo)
    );
  end loop;

  select coalesce(jsonb_agg(value order by value ->> 'permissao'), '[]'::jsonb)
    into v_resultado
  from jsonb_array_elements(v_resultado);

  return v_resultado;
exception
  when others then
    return null;
end;
$$;
