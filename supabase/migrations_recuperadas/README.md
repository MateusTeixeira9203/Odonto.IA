# NÃO APLICAR NADA DESTA PASTA

**Isto é acervo de referência da produção.** Os 47 arquivos `.sql` são o texto que o histórico da produção (`supabase_migrations.schema_migrations`) guardou e que não estava no repositório (OD-020). Foram gravados **sem edição** e cada um tem o md5 do histórico da produção.

- A pasta fica **fora de `supabase/migrations/`**: o Supabase CLI não a lê (`db push`, `db reset` e `migration list` só olham `supabase/migrations/`; `config.toml` tem `schema_paths = []` e a seed é só `./seed.sql`).
- Não copie, não renomeie e não execute arquivo daqui em nenhum banco. Não edite: o `.gitattributes` fixa `-text` para que o md5 de cada texto continue igual ao da produção.
- Destino previsto: a Opção B da OD-020 move estes textos para `supabase/migrations/` com as versões da produção, numa tarefa própria, e esta pasta é apagada.

## PERIGO: nunca aplicar, nem por engano

1. **`divergentes/20260628000001_081_complete_onboarding_foco.sql`**: começa com um `DROP FUNCTION IF EXISTS public.complete_onboarding(...)` **real**, seguido de linhas que **não são SQL** (resumo com "..."). Fora de uma transação, ele derruba a assinatura antiga e falha no resto, quebrando o onboarding. A fonte da função é o catálogo, não este arquivo.
2. **`20260915203650_r169d_excluir_ficha_preservando_financeiro.sql`**: termina com `GRANT EXECUTE ... TO authenticated`. A M3 (OD-015b1, `20261025103502`) **revogou** esse execute de propósito; reaplicar este arquivo desfaz o revoke e reabre o apagar de ficha sem motivo, sem confirmação e sem auditoria.

## Cuidado: mexem em estrutura ou dados já existentes

- **`DROP CONSTRAINT` sem `IF EXISTS`:**
  - `20260611034629_tratamentos_multi_status_v2.sql` (`tratamentos_status_check`);
  - `20260923041134_r172_estoque_kits_usos.sql` (`estoque_movimentos_origem_tipo_check`).
- **`UPDATE` em massa (dados):**
  - `20260611034629_tratamentos_multi_status_v2.sql` (`UPDATE tratamentos SET status = 'principal' WHERE status = 'ativo'`);
  - `divergentes/20260705191924_089_hierarquia_silo_rls.sql` (dois `UPDATE` em `clinicas`: plano e `limite_dentistas`).
- Vários arquivos concedem `GRANT` a `authenticated` e `service_role` (r157, r159b, r163, r172, r181). Eram corretos na época; reaplicar não é neutro.
- Os arquivos em `divergentes/` são o texto que **rodou na produção**, diferente do arquivo de mesmo nome em `supabase/migrations/`.

Nunca reaplicar também (fora desta pasta): `017_fichas_bucket_public` (deixaria o bucket `fichas` público), `082` e `r140a` (carga única de dados).
