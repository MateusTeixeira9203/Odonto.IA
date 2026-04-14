#!/usr/bin/env node
/**
 * DentAI — Limpeza completa para testes do zero (Node.js)
 *
 * Pré-requisitos:
 *   npm install @supabase/supabase-js dotenv
 *
 * Como rodar (na raiz do projeto):
 *   node scripts/cleanup-test-data.js
 *
 * As variáveis são lidas do .env.local (ou .env).
 * ATENÇÃO: destrói todos os dados e usuários. Use só em dev/teste!
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config(); // fallback para .env

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env ou .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Ordem de deleção: folhas antes das raízes para evitar erros de FK.
// Usamos DELETE com filtro universal ao invés de TRUNCATE porque a
// service role não tem permissão de TRUNCATE via PostgREST.
const TABLES_IN_ORDER = [
  "google_tokens",
  "pagamentos",
  "orcamento_itens",
  "mensagens_bot",
  "planejamento_secoes",
  "paciente_documentos",
  "instancias_whatsapp",
  "bot_config",
  "convites",
  "configuracoes_clinica",
  "horarios_disponiveis",
  "conversas_bot",
  "agendamentos",
  "planejamento_etapas",
  "ficha_arquivos",
  "orcamentos",
  "planejamentos",
  "fichas",
  "pacientes",
  "procedimentos",
  "dentistas",
  "clinicas",
];

async function deleteAllRows(table) {
  // Deleta usando um filtro que always true (id != UUID impossível)
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .not("id", "is", null);

  if (error) {
    // Tabela pode não existir em ambientes que não aplicaram todas as migrations
    if (error.code === "42P01") {
      console.log(`⚠️  ${table}: tabela não existe (migration pendente?)`);
    } else {
      console.error(`❌ ${table}: ${error.message}`);
    }
    return 0;
  }
  return count ?? 0;
}

async function deleteAllUsers() {
  const { data, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });

  if (listError) {
    console.error("❌ Erro ao listar usuários:", listError.message);
    return;
  }

  const users = data?.users ?? [];
  console.log(`\n   ${users.length} usuário(s) encontrado(s) no Auth`);

  for (const user of users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`   ❌ ${user.email}: ${error.message}`);
    } else {
      console.log(`   ✅ ${user.email ?? user.id}`);
    }
  }
}

async function main() {
  console.log("🧹 DentAI — Limpeza completa para testes\n");
  console.log("   URL:", SUPABASE_URL);
  console.log("   ─────────────────────────────────────\n");

  // Confirmação de segurança
  if (process.env.NODE_ENV === "production") {
    console.error("❌ Recusado: NODE_ENV=production. Só rode em dev/teste.");
    process.exit(1);
  }

  let total = 0;

  console.log("📦 Limpando tabelas de negócio...\n");
  for (const table of TABLES_IN_ORDER) {
    const deleted = await deleteAllRows(table);
    if (deleted > 0) {
      console.log(`   ✅ ${table}: ${deleted} linha(s) removida(s)`);
    } else {
      console.log(`   ○  ${table}: vazia`);
    }
    total += deleted;
  }

  console.log(`\n   Total de linhas removidas: ${total}`);

  console.log("\n🔐 Deletando usuários do Auth...");
  await deleteAllUsers();

  console.log("\n✅ Banco limpo e pronto para novos cadastros de teste.\n");
}

main().catch((err) => {
  console.error("\n❌ Erro inesperado:", err);
  process.exit(1);
});
