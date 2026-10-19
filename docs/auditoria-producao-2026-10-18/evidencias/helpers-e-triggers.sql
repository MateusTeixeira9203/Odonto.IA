-- public.update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

-- public.has_active_membership
CREATE OR REPLACE FUNCTION public.has_active_membership()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinica_usuarios cu
    JOIN public.users u ON u.id = auth.uid()
    WHERE cu.usuario_id = auth.uid()
      AND cu.clinica_id = u.active_clinica_id
      AND cu.status = 'ativo'
  )
  OR EXISTS (
    SELECT 1
    FROM public.dentistas d
    JOIN public.users u ON u.id = auth.uid()
    WHERE d.user_id = auth.uid()
      AND d.ativo = true
      AND d.clinica_id = u.active_clinica_id
  )
$function$
;

-- private.definir_titular_financeiro
CREATE OR REPLACE FUNCTION private.definir_titular_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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
$function$
;

