-- R-173: este trigger atende cinco tabelas. `origem_lancamento` só existe nas
-- tabelas de lançamentos manuais; ler NEW.origem_lancamento ao inserir orçamento
-- abortava a criação com SQLSTATE 42703.
create or replace function private.definir_titular_financeiro()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_titular text;
  v_origem_lancamento text := to_jsonb(new) ->> 'origem_lancamento';
begin
  if tg_table_name = 'pagamentos' then
    select o.titular_financeiro into v_titular
    from public.orcamentos o
    where o.id = new.orcamento_id and o.clinica_id = new.clinica_id;
    if v_titular is null then
      raise exception 'orcamento financeiro ausente ou fora da clinica';
    end if;
  elsif tg_table_name = 'orcamento_cobrancas' then
    select o.titular_financeiro into v_titular
    from public.orcamentos o
    where o.id = new.orcamento_id and o.clinica_id = new.clinica_id;
    if v_titular is null then
      raise exception 'orcamento financeiro ausente ou fora da clinica';
    end if;
  elsif tg_table_name in ('despesas', 'receitas_manuais') and v_origem_lancamento = 'pessoal' then
    if new.dentista_id is null or not exists (
      select 1 from public.dentistas d
      where d.id = new.dentista_id and d.clinica_id = new.clinica_id
        and d.user_id = auth.uid() and d.ativo and d.role in ('admin', 'dentista')
    ) then
      raise exception 'lancamento pessoal exige o perfil clinico do usuario';
    end if;
    v_titular := 'dentista';
  elsif tg_table_name in ('despesas', 'receitas_manuais') and v_origem_lancamento = 'clinica' then
    v_titular := 'clinica';
  else
    v_titular := private.titular_financeiro_modalidade(new.clinica_id);
  end if;

  new.titular_financeiro := v_titular;
  return new;
end;
$$;
