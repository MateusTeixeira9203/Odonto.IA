-- R-173 — a regra financeira da UI e do banco precisa ter a mesma precedência:
-- encaminhamento explícito, autoria do evento, autoria da ficha. Não toca dados, RLS ou grants.
do $r173$
declare
  v_funcao regprocedure;
  v_definicao text;
  v_corrigida text;
begin
  foreach v_funcao in array array[
    'public.criar_orcamento_com_eventos(uuid,uuid,uuid,numeric,jsonb)'::regprocedure,
    'public.criar_orcamento_com_eventos_r157(uuid,uuid,uuid,numeric,jsonb)'::regprocedure,
    'public.adicionar_itens_orcamento_com_eventos(uuid,jsonb)'::regprocedure,
    'public.adicionar_itens_orcamento_com_eventos_r157(uuid,jsonb)'::regprocedure,
    'public.validar_evento_orcamento_da_ficha()'::regprocedure,
    'public.validar_grupo_orcamento_persistido()'::regprocedure
  ] loop
    select pg_get_functiondef(v_funcao) into v_definicao;
    v_corrigida := regexp_replace(
      v_definicao,
      E'coalesce\\(\\s*e\\.encaminhado_para\\s*,\\s*f\\.dentista_id\\s*\\)',
      'coalesce(e.encaminhado_para, e.dentista_id, f.dentista_id)',
      'g'
    );

    -- Uma instalação já corrigida pode executar esta migration sem regredir. Uma definição
    -- fora do contrato falha antes de alterar qualquer função, em vez de substituir lógica
    -- desconhecida às cegas.
    if v_corrigida = v_definicao then
      if position('coalesce(e.encaminhado_para, e.dentista_id, f.dentista_id)' in v_definicao) > 0 then
        continue;
      end if;
      raise exception 'r173_regra_responsavel_inesperada:%', v_funcao;
    end if;

    execute v_corrigida;
  end loop;
end;
$r173$;

notify pgrst, 'reload schema';
