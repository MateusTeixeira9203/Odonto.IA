// PGLITE_MODULE_PATH=/tmp/r169-db-check/pglite/package/dist/index.js node scripts/tests/r165-cadastro-comercial.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.PGLITE_MODULE_PATH) throw new Error('Defina PGLITE_MODULE_PATH.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const [clinicalUser, managerUser, individualOwnerUser, legacyUser] = [uuid(1), uuid(2), uuid(3), uuid(4)];

try {
  await db.exec(`
    create role anon; create role authenticated; create schema private; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.actor', true), '')::uuid
    $$;
    create function public.update_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at = clock_timestamp(); return new; end
    $$;
    create table public.clinicas(
      id uuid primary key, nome text, plano text, status text, limite_dentistas integer,
      telefone text, cidade text, estado text
    );
    create table public.users(id uuid primary key, email text not null, active_clinica_id uuid);
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create table public.dentistas(
      id uuid primary key, clinica_id uuid not null references public.clinicas(id), user_id uuid not null,
      nome text, cro text, especialidade text[], telefone text, email text, role text, ativo boolean,
      foco_principal text
    );
    create table public.clinica_usuarios(
      id uuid primary key, usuario_id uuid not null, clinica_id uuid not null references public.clinicas(id),
      role text not null, status text not null
    );
    create table public.clinica_governanca(
      clinica_id uuid primary key references public.clinicas(id), responsavel_usuario_id uuid not null,
      estado text not null, modelo_clinica text not null, modelo_estoque text, estoque_ativo boolean default false
    );
    insert into public.users(id, email) values
      ('${clinicalUser}', 'clinical@example.test'),
      ('${managerUser}', 'manager@example.test'),
      ('${individualOwnerUser}', 'individual-owner@example.test'),
      ('${legacyUser}', 'legacy@example.test');
    insert into auth.users(id,raw_user_meta_data) select id,'{}'::jsonb from public.users;
    select set_config('test.actor', '${clinicalUser}', false);
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20260916014500_r165_cadastro_assinatura_comercial.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20260916021902_r165_onboarding_estoque_perfil.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20260916023552_r165_trava_piloto_onboarding.sql', import.meta.url), 'utf8'));

  // O endpoint público não depende apenas do gate da UI: por padrão, uma chamada
  // autenticada direta não cria dados e não consegue habilitar o piloto privado.
  await db.exec('set role authenticated');
  await assert.rejects(
    db.query(`select public.iniciar_onboarding_r165(
      'individual', 'colaborativa', true, 'Clínica Bloqueada', 'Dra Bloqueada', 'CRO 0', array['Clínica'], null, null, null, null
    )`),
    /R165_PILOTO_DESABILITADO/,
  );
  await assert.rejects(
    db.query('update private.r165_piloto_onboarding set habilitado=true where singleton'),
    /permission denied/i,
  );
  await assert.rejects(
    db.query(`select private.iniciar_onboarding_r165(
      'individual', 'colaborativa', true, 'Clínica Privada', 'Dra Privada', 'CRO 0', array['Clínica'], null, null, null, null
    )`),
    /permission denied/i,
  );
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int total from public.clinicas')).rows[0].total, 0);
  await db.exec('update private.r165_piloto_onboarding set habilitado=true where singleton');

  const individual = (await db.query(
    `select public.iniciar_onboarding_r165(
       'individual', 'colaborativa', true, 'Clínica Individual', 'Dra Individual', 'CRO 1', array['Clínica'], null, null, null, 'crescer'
     ) resultado`,
  )).rows[0].resultado;
  assert.equal(individual.ok, true);
  assert.deepEqual((await db.query('select estoque_ativo,modelo_estoque,modelo_clinica from clinica_governanca where clinica_id=$1', [individual.data.clinicaId])).rows[0], {estoque_ativo:true, modelo_estoque:'colaborativa', modelo_clinica:'colaborativa'});
  assert.equal(individual.data.modalidade, 'individual');
  assert.equal(individual.data.checkoutPendente, true);
  assert.notEqual(individual.data.dentistaId, null);
  assert.equal((await db.query('select status, quantidade_contratada, modalidade from public.assinaturas_comerciais')).rows[0].status, 'aguardando_checkout');
  assert.equal((await db.query('select count(*)::int total from public.coberturas_assinatura')).rows[0].total, 0);
  assert.equal((await db.query('select private.resolver_cobertura_comercial($1,$2) situacao', [individual.data.clinicaId, clinicalUser])).rows[0].situacao, 'sem_cobertura');
  await assert.rejects(
    db.query(`insert into public.assinaturas_comerciais(
      clinica_id,modalidade,pagador_usuario_id,status,quantidade_contratada
    ) values($1,'centralizada',$2,'aguardando_checkout',1)`, [individual.data.clinicaId, clinicalUser]),
    /MODALIDADE_COMERCIAL_INVALIDA/,
  );

  await db.query("select set_config('test.actor',$1,false)", [managerUser]);
  const central = (await db.query(
    `select public.iniciar_onboarding_r165(
       'centralizada', 'gerida', false, 'Clínica Gerida', 'Responsável', null, '{}', null, null, null, null
     ) resultado`,
  )).rows[0].resultado;
  assert.equal(central.ok, true);
  assert.deepEqual((await db.query('select estoque_ativo,modelo_estoque from clinica_governanca where clinica_id=$1', [central.data.clinicaId])).rows[0], {estoque_ativo:true, modelo_estoque:'gerida'});
  assert.equal((await db.query("select raw_user_meta_data->>'nome' nome from auth.users where id=$1", [managerUser])).rows[0].nome, 'Responsável');
  assert.equal(central.data.dentistaId, null);
  assert.equal((await db.query('select quantidade_contratada from public.assinaturas_comerciais where id=$1', [central.data.assinaturaId])).rows[0].quantidade_contratada, null);
  const centralMembership = (await db.query('select role from public.clinica_usuarios where clinica_id=$1', [central.data.clinicaId])).rows[0];
  assert.equal(centralMembership.role, 'gestor');
  const governance = (await db.query('select responsavel_usuario_id, modelo_clinica from public.clinica_governanca where clinica_id=$1', [central.data.clinicaId])).rows[0];
  assert.deepEqual(governance, { responsavel_usuario_id: managerUser, modelo_clinica: 'gerida' });
  assert.equal((await db.query('select private.resolver_cobertura_comercial($1,$2) situacao', [central.data.clinicaId, managerUser])).rows[0].situacao, 'sem_cobertura');

  const centralDentists = [uuid(50), uuid(51), uuid(52)];
  for (const dentistaId of centralDentists) {
    await db.query('insert into public.clinica_usuarios(id,clinica_id,usuario_id,role,status) values($1,$2,$3,$4,$5)', [uuid(Number(dentistaId.slice(-3))+100), central.data.clinicaId, uuid(Number(dentistaId.slice(-3))), 'dentista', 'ativo']);
    await db.query(
      'insert into public.dentistas(id,clinica_id,user_id,nome,role,ativo) values($1,$2,$3,$4,$5,true)',
      [dentistaId, central.data.clinicaId, uuid(Number(dentistaId.slice(-3))), 'Dentista da clínica', 'dentista'],
    );
  }
  await assert.rejects(db.query("update public.assinaturas_comerciais set status='active' where id=$1", [central.data.assinaturaId]), /assinaturas_comerciais_modalidade_consistente/);
  await db.query("update public.assinaturas_comerciais set status='active', quantidade_contratada=2 where id=$1", [central.data.assinaturaId]);
  await db.query('insert into public.coberturas_assinatura(contrato_id,clinica_id,dentista_id) values($1,$2,$3),($1,$2,$4)', [
    central.data.assinaturaId, central.data.clinicaId, centralDentists[0], centralDentists[1],
  ]);
  assert.equal((await db.query('select private.resolver_cobertura_comercial($1,$2) situacao', [central.data.clinicaId, managerUser])).rows[0].situacao, 'coberto');
  await assert.rejects(
    db.query('insert into public.coberturas_assinatura(contrato_id,clinica_id,dentista_id) values($1,$2,$3)', [
      central.data.assinaturaId, central.data.clinicaId, centralDentists[2],
    ]),
    /COBERTURA_LIMITE_ATINGIDO/,
  );

  await db.query("select set_config('test.actor',$1,false)", [individualOwnerUser]);
  const ownerIndividual = (await db.query(
    `select public.iniciar_onboarding_r165(
       'individual', 'gerida', false, 'Clínica Individual Gerida', 'Responsável', null, '{}', null, null, null, null
     ) resultado`,
  )).rows[0].resultado;
  assert.equal(ownerIndividual.ok, true);
  assert.equal(ownerIndividual.data.dentistaId, null);
  assert.equal(ownerIndividual.data.assinaturaId, null);
  assert.equal((await db.query('select private.resolver_cobertura_comercial($1,$2) situacao', [ownerIndividual.data.clinicaId, individualOwnerUser])).rows[0].situacao, 'sem_cobertura');
  assert.deepEqual((await db.query('select modalidade from public.configuracoes_comerciais_clinica where clinica_id=$1', [ownerIndividual.data.clinicaId])).rows[0], { modalidade: 'individual' });
  assert.deepEqual((await db.query('select modelo_clinica from public.clinica_governanca where clinica_id=$1', [ownerIndividual.data.clinicaId])).rows[0], { modelo_clinica: 'gerida' });

  await assert.rejects(db.query('update public.assinaturas_comerciais set quantidade_contratada=1 where id=$1', [central.data.assinaturaId]), /COBERTURA_LIMITE_ATINGIDO/);
  const activeContract = individual.data.assinaturaId;
  await db.query("update public.assinaturas_comerciais set status='active' where id=$1", [activeContract]);
  await db.query('insert into public.coberturas_assinatura(contrato_id,clinica_id,dentista_id) values($1,$2,$3)', [activeContract, individual.data.clinicaId, individual.data.dentistaId]);
  assert.equal((await db.query('select private.resolver_cobertura_comercial($1,$2) situacao', [individual.data.clinicaId, clinicalUser])).rows[0].situacao, 'coberto');

  const legacyClinic = uuid(40);
  await db.exec(`
    insert into public.clinicas(id,nome) values ('${legacyClinic}', 'Legado');
    insert into public.clinica_usuarios(id,usuario_id,clinica_id,role,status)
      values ('${uuid(41)}','${legacyUser}','${legacyClinic}','dentista','ativo');
  `);
  assert.equal((await db.query('select private.resolver_cobertura_comercial($1,$2) situacao', [legacyClinic, legacyUser])).rows[0].situacao, 'legado');
  process.stdout.write('R165 cadastro/comercial: PGlite passed\n');
} finally {
  await db.close();
}
