select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname in ('get_my_clinica_id','get_my_dentista_id','get_my_role','belongs_to_active_clinic','is_clinic_staff','is_clinic_dentista','commercial_write_allowed')),
 'columns',(select jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,'type',udt_name,'nullable',is_nullable)) from information_schema.columns where table_schema='public'),
 'indexes',(select jsonb_agg(to_jsonb(i)) from pg_indexes i where schemaname='public'),
 'constraints',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid))) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'),
 'triggers',(select jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'definition',pg_get_triggerdef(t.oid))) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal)
 ) as structure;
