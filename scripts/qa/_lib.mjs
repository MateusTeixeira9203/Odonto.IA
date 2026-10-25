import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';

export const REF_QA = 'uhuxteswtvgdnlixwrdu';
export const REF_PROD = 'zenfemoxvwerplrjgfqz';
export const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const QA_DIR = path.join(ROOT, '.qa');

export class QaError extends Error {
  constructor(code, message, exitCode = 2) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}
export function exigirHostQa(texto) {
  if (typeof texto !== 'string' || texto.toLowerCase().includes(REF_PROD)) {
    throw new QaError('HOST', 'somente odonto-qa é permitido');
  }
  let url, decoded;
  try { url = new URL(texto); decoded = decodeURIComponent(texto); } catch { throw new QaError('HOST', 'host QA ausente ou inválido'); }
  const http = ['http:', 'https:'].includes(url.protocol) && url.hostname === `${REF_QA}.supabase.co`;
  const postgres = ['postgres:', 'postgresql:'].includes(url.protocol) && (
    url.hostname === `db.${REF_QA}.supabase.co` ||
    (url.hostname.endsWith('.pooler.supabase.com') && url.username === `postgres.${REF_QA}`)
  );
  if ((!http && !postgres) || decoded.toLowerCase().includes(REF_PROD)) {
    throw new QaError('HOST', 'somente o host odonto-qa é permitido');
  }
  return url;
}
export function validarPorta(p) {
  if (!/^30[12]\d$/.test(String(p))) throw new QaError('PORTA', 'use uma porta de 3010 a 3029');
  return Number(p);
}
export function configPgQa(connection, ca) {
  const url = exigirHostQa(connection);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new QaError('HOST', 'QA_DB_URL deve ser PostgreSQL');
  // pg's connection-string query parameters must never override the validated host/user.
  return {
    host: url.hostname, port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1) || 'postgres'),
    ssl: { rejectUnauthorized: true, ca }, connectionTimeoutMillis: 15000, statement_timeout: 30000,
  };
}
export function validarNome(n) {
  if (typeof n !== 'string' || !/^[a-z0-9-]{2,20}$/.test(n)) throw new QaError('NOME', 'nome de snapshot inválido');
  return n;
}
export function validarCommit(sha) {
  if (typeof sha !== 'string' || !/^[a-f\d]{7,40}$/i.test(sha)) throw new QaError('COMMIT', 'use um SHA de 7 a 40 caracteres hexadecimais');
  return sha;
}
export function flags(options, required = [], args = process.argv.slice(2)) {
  let result;
  try {
    result = parseArgs({ args, options, strict: true, allowPositionals: false, tokens: true });
    const names = result.tokens.filter(t => t.kind === 'option').map(t => t.name);
    if (new Set(names).size !== names.length || required.some(k => !result.values[k])) throw new Error();
  } catch { throw new QaError('FLAGS', 'parâmetros ausentes, repetidos ou desconhecidos'); }
  return result.values;
}
export function resolverFixture(arquivo, { limpeza = false, root = ROOT } = {}) {
  if (typeof arquivo !== 'string' || !/^[a-z0-9-]+\.sql$/.test(arquivo) || arquivo.endsWith('-cleanup.sql') !== limpeza) {
    throw new QaError('FIXTURE', limpeza ? 'informe um arquivo -cleanup.sql' : 'informe um seed .sql, sem caminho ou sufixo -cleanup');
  }
  const dir = path.join(root, 'supabase', 'tests', 'fixtures');
  const file = path.join(dir, arquivo);
  if (!fs.existsSync(file) || !fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink() ||
      path.dirname(fs.realpathSync(file)) !== fs.realpathSync(dir)) {
    throw new QaError('FIXTURE', 'arquivo regular ausente dentro de supabase/tests/fixtures');
  }
  return file;
}

// SQL comments and literals cannot disguise executable DDL or transaction commands.
function sqlVisivel(sql, dollarBodies = true) {
  let out = '';
  for (let i = 0; i < sql.length;) {
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i); i = end < 0 ? sql.length : end; out += ' ';
    } else if (sql.startsWith('/*', i)) {
      let depth = 1; i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) { depth++; i += 2; }
        else if (sql.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw new QaError('SQL', 'comentário SQL incompleto');
      out += ' ';
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      const escaped = quote === "'" && /(?:^|\W)e$/i.test(sql.slice(0, i));
      let closed = false; i++;
      while (i < sql.length) {
        if (escaped && sql[i] === '\\') i += 2;
        else if (sql[i] === quote && sql[i + 1] === quote) i += 2;
        else if (sql[i++] === quote) { closed = true; break; }
      }
      if (!closed) throw new QaError('SQL', 'literal SQL incompleto');
      out += ' ';
    } else if (sql[i] === '$' && /^\$(?:[a-z_]\w*)?\$/i.test(sql.slice(i))) {
      const tag = sql.slice(i).match(/^\$(?:[a-z_]\w*)?\$/i)[0];
      const end = sql.indexOf(tag, i + tag.length);
      if (end < 0) throw new QaError('SQL', 'bloco SQL incompleto');
      out += dollarBodies ? ` ${sqlVisivel(sql.slice(i + tag.length, end))} ` : ' ';
      i = end + tag.length;
    } else out += sql[i++];
  }
  return out;
}
export function guardaSqlFixture(sql) {
  if (!sql.trim() || sql.toLowerCase().includes(REF_PROD)) throw new QaError('SQL', 'SQL vazio ou com referência de produção');
  const visible = sqlVisivel(sql);
  if (/\b(create|alter|drop|grant|revoke|truncate|copy|execute|pg_read_file|pg_read_binary_file|pg_ls_dir|lo_import|lo_export|dblink_connect)\b/i.test(visible)) {
    throw new QaError('SQL', 'fixture aceita apenas dados; DDL, privilégios, execução dinâmica e acesso a arquivos são proibidos');
  }
  return sql;
}
export function temTransacao(sql) {
  return /\b(begin|commit|rollback|start\s+transaction|savepoint|release)\b/i.test(sqlVisivel(sql, false));
}
export function trocarMarcadoresSenha(sql, env) {
  return sql.replace(/<SENHA_QA_[A-Z0-9_]+>/g, marker => {
    const name = marker.slice(1, -1);
    if (!env[name]) throw new QaError('SENHA', `defina ${name} na sessão`);
    return String(env[name]).replaceAll("'", "''");
  });
}
export function mascarar(texto, segredos = []) {
  let result = String(texto);
  const values = segredos.map(s => typeof s === 'string' ? s : s.valor).filter(Boolean);
  const variants = values.flatMap(v => [v, encodeURIComponent(v), v.replaceAll("'", "''"), JSON.stringify(v).slice(1, -1)]);
  for (const value of [...new Set(variants)].sort((a, b) => b.length - a.length)) result = result.split(value).join('[OCULTO]');
  return result.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[URL_BANCO_OCULTA]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[TOKEN_OCULTO]');
}
function envPair(line) {
  const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z\d_]*)\s*=\s*(.*)$/i);
  if (!match) return null;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  else value = value.replace(/\s+#.*$/, '').trim();
  return [match[1], value];
}
export async function lerVariavel(arquivo, nome) {
  const input = fs.createReadStream(arquivo, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      // Only retain the requested value, especially when QA_DB_URL shares a file with production.
      const name = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z\d_]*)\s*=/i)?.[1];
      if (name === nome) return envPair(line)[1];
    }
  } finally { lines.close(); input.destroy(); }
  return undefined;
}
export function contasQa(texto) {
  const senha = texto.match(/^#\s*Senha de todas:\s*(.+)\r?$/m)?.[1]?.trim();
  if (!senha) throw new QaError('CONTAS', 'credencial fictícia QA indisponível');
  const contas = [...texto.matchAll(/^\s*([^\s#]+@example\.invalid)\s*(?:->|→)\s*(.+)\r?$/gm)]
    .map(m => ({ email: m[1], descricao: m[2].trim(), senha }));
  if (!contas.length) throw new QaError('CONTAS', 'contas fictícias QA indisponíveis');
  return { senha, contas };
}
export function verificarEnvSnapshot(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.env') || entry.name === 'env.local') {
      if (!entry.isFile() || entry.isSymbolicLink()) throw new QaError('ENV', 'arquivo de ambiente deve ser regular');
      if (fs.readFileSync(path.join(dir, entry.name), 'utf8').toLowerCase().includes(REF_PROD)) {
        throw new QaError('HOST', 'referência de produção no ambiente do snapshot');
      }
    }
  }
  for (const name of ['.env', '.env.local', '.env.development', '.env.production', '.env.production.local']) {
    if (fs.existsSync(path.join(dir, name))) throw new QaError('ENV', 'ambiente concorrente do Next; use somente .env.development.local QA');
  }
}
export function childEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([name, value]) => !/^(NEXT_PUBLIC_SUPABASE_|SUPABASE_)/i.test(name) && !String(value).toLowerCase().includes(REF_PROD)));
}
export function planoE2e({ porta, pasta, escopo = 'changed', records, env = {}, root = ROOT }) {
  const port = validarPorta(porta);
  if (!['changed', 'final'].includes(escopo) || !/^e2e\/(?:[a-z\d_-]+\/)*[a-z\d_-]+$/i.test(pasta ?? '')) {
    throw new QaError('FLAGS', 'use uma subpasta e2e/ existente e escopo changed ou final');
  }
  const record = records.find(r => r.porta === port);
  if (!record) throw new QaError('REGISTRO', 'porta sem snapshot registrado');
  return {
    record,
    args: [path.join(root, 'node_modules/@playwright/test/cli.js'), 'test', pasta, '--workers=1', '--retries=0'],
    env: { ...env, QA_BASE_URL: `http://localhost:${port}`, MD_SCOPE: escopo },
  };
}
export async function contexto(root = ROOT) {
  const envFile = path.join(root, '.env.development.local');
  exigirHostQa(await lerVariavel(envFile, 'NEXT_PUBLIC_SUPABASE_URL'));
  const text = fs.readFileSync(envFile, 'utf8');
  if (text.toLowerCase().includes(REF_PROD)) throw new QaError('HOST', 'referência de produção no ambiente usado');
  const env = childEnv();
  const segredos = [];
  for (const line of text.split(/\r?\n/)) {
    const pair = envPair(line);
    if (pair) { env[pair[0]] = pair[1]; if (pair[1].length >= 8) segredos.push({ nome: pair[0], valor: pair[1] }); }
  }
  for (const [nome, valor] of Object.entries(process.env)) {
    if (/(SECRET|TOKEN|PASSWORD|COOKIE|API_KEY|DB_URL)/i.test(nome) && valor) segredos.push({ nome, valor });
  }
  const accountsFile = path.join(root, '.env.qa-contas');
  const accounts = contasQa(fs.readFileSync(accountsFile, 'utf8'));
  segredos.push({ nome: 'SENHA_QA_CONTAS', valor: accounts.senha });
  for (const account of accounts.contas) segredos.push({ nome: 'EMAIL_QA', valor: account.email });
  return { root, env, segredos, accounts };
}
export async function cli(main) {
  try { await main(); }
  catch (error) {
    console.error(error instanceof QaError ? `RECUSA ${error.code} · ${error.message}` : 'FALHOU OPERACAO · operação não concluída; detalhes sensíveis omitidos');
    process.exitCode = error instanceof QaError ? error.exitCode : 1;
  }
}
export function executar(command, args, { cwd = ROOT, env = process.env, log, segredos = [] } = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data.toString(); });
    child.stderr.on('data', data => { output += data.toString(); });
    child.on('error', () => { output += '\nFalha ao iniciar processo.\n'; });
    child.on('close', code => {
      const safe = mascarar(output, segredos);
      if (log) fs.appendFileSync(log, safe);
      resolve({ code: code ?? 1, output: safe });
    });
  });
}
export async function git(args, cwd = ROOT) {
  const result = await executar('git', args, { cwd });
  if (result.code) throw new QaError('GIT', 'operação Git recusada; confira commit e worktree');
  return result.output.trim();
}
export function snapshotPath(nome, root = ROOT) {
  validarNome(nome);
  return path.resolve(root, '..', `${path.basename(root)}-${nome}`);
}
export function registros() {
  const file = path.join(QA_DIR, 'snapshots.json');
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) throw new QaError('ESTADO', 'registro de snapshots inválido');
  for (const r of data) {
    validarNome(r.nome); validarCommit(r.commit); validarPorta(r.porta);
    if (!Number.isSafeInteger(r.pid) || r.pid <= 0) throw new QaError('ESTADO', 'PID inválido no registro');
  }
  return data;
}
export function gravarRegistros(data) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const file = path.join(QA_DIR, 'snapshots.json');
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
}
export async function comTrava(fn) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const file = path.join(QA_DIR, 'snapshots.lock');
  let fd;
  try { fd = fs.openSync(file, 'wx'); }
  catch { throw new QaError('OCUPADO', 'há outra operação de snapshot em andamento'); }
  try { return await fn(); } finally { fs.closeSync(fd); fs.unlinkSync(file); }
}
export async function pidDaPorta(porta) {
  validarPorta(porta);
  const result = await executar('netstat', ['-ano', '-p', 'tcp']);
  if (result.code) throw new QaError('PORTA', 'não foi possível conferir as portas por netstat');
  const pids = new Set(result.output.split(/\r?\n/).flatMap(line => {
    const parts = line.trim().split(/\s+/);
    return parts[0] === 'TCP' && parts[1]?.endsWith(`:${porta}`) && /LISTEN/i.test(parts[3]) ? [Number(parts[4])] : [];
  }));
  if (pids.size > 1) throw new QaError('PORTA', 'porta ocupada por processos diferentes');
  return [...pids][0] ?? null;
}
export async function comandoPid(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new QaError('PID', 'PID inválido');
  const ps = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const result = await executar(ps, ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`]);
  if (result.code) throw new QaError('PID', 'não foi possível conferir a identidade do processo');
  return result.output;
}
export function processoSnapshot(command, porta, dir) {
  const normalized = command.replaceAll('\\', '/').toLowerCase();
  return normalized.includes(dir.replaceAll('\\', '/').toLowerCase() + '/node_modules/next/') &&
    /\bnext\b/.test(normalized) && new RegExp(`(?:^|\\s)-p\\s+${validarPorta(porta)}(?:\\s|$)`).test(command);
}
export async function pararPid(pid, porta, dir) {
  const command = await comandoPid(pid);
  if (!command.trim()) return;
  if (!processoSnapshot(command, porta, dir)) throw new QaError('PID', 'o processo não é o Next deste snapshot; nada foi encerrado');
  const result = await executar('taskkill', ['/PID', String(pid), '/T', '/F']);
  if (result.code) throw new QaError('PID', 'não foi possível encerrar a árvore do snapshot');
}
export async function responde(porta) {
  try { const response = await fetch(`http://localhost:${validarPorta(porta)}/login`, { signal: AbortSignal.timeout(2500), redirect: 'manual' }); await response.body?.cancel(); return response.status < 500; }
  catch { return false; }
}
export function desfazerJuncao(dir, root = ROOT) {
  const link = path.join(dir, 'node_modules');
  const target = path.join(root, 'node_modules');
  if (path.resolve(dir) === path.resolve(root)) throw new QaError('CAMINHO', 'o repositório principal não pode ser removido');
  if (fs.existsSync(link)) {
    if (!fs.lstatSync(link).isSymbolicLink() || fs.realpathSync(link) !== fs.realpathSync(target)) {
      throw new QaError('JUNCAO', 'node_modules não é a junção esperada; nada foi removido');
    }
    fs.unlinkSync(link);
  }
  if (!fs.existsSync(path.join(target, 'next', 'package.json'))) throw new QaError('JUNCAO', 'verificação do node_modules principal falhou');
}
export async function aplicarFixture(arquivo, { limpeza = false, ensaio = false } = {}) {
  const file = resolverFixture(arquivo, { limpeza });
  const original = guardaSqlFixture(fs.readFileSync(file, 'utf8'));
  if (ensaio && temTransacao(original)) throw new QaError('SQL', 'ensaio exige fixture sem transação própria');
  const sql = trocarMarcadoresSenha(original, process.env);
  guardaSqlFixture(sql);
  const ctx = await contexto();
  const connection = await lerVariavel(path.join(ROOT, '.env.qa-dump'), 'QA_DB_URL');
  const url = exigirHostQa(connection);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new QaError('HOST', 'QA_DB_URL deve ser PostgreSQL');
  ctx.segredos.push({ nome: 'QA_DB_URL', valor: connection });
  if (url.password) ctx.segredos.push({ nome: 'QA_DB_PASSWORD', valor: decodeURIComponent(url.password) });
  for (const marker of original.matchAll(/<(SENHA_QA_[A-Z0-9_]+)>/g)) ctx.segredos.push({ nome: marker[1], valor: process.env[marker[1]] });
  const { Client } = await import('pg');
  const client = new Client(configPgQa(connection, fs.readFileSync(new URL('./supabase-ca.crt', import.meta.url))));
  const hash = createHash('sha256').update(original).digest('hex').slice(0, 8);
  const query = temTransacao(sql) ? sql : `begin;\n${sql}\n${ensaio ? 'rollback' : 'commit'};`;
  const start = Date.now();
  let outcome = 'falhou';
  try {
    await client.connect();
    await client.query(query);
    outcome = ensaio ? 'ensaio' : 'aplicada';
    console.log(`${ensaio ? 'ENSAIO OK' : 'APLICADA'} ${arquivo} no odonto-qa · ${Date.now() - start} ms · sha256 ${hash}`);
  } catch (error) {
    const code = /^[A-Z\d_]{2,40}$/.test(error.code ?? '') ? error.code : 'CONEXAO';
    // Read only message/code, never DETAIL, query, or the driver's whole error object.
    const message = mascarar(error.message ?? 'operação de fixture não concluída', ctx.segredos).replace(/[\r\n]+/g, ' ').slice(0, 180);
    console.error(`FALHOU ${arquivo} · ${code} · ${message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
    fs.mkdirSync(QA_DIR, { recursive: true });
    fs.appendFileSync(path.join(QA_DIR, 'fixtures.log'), `${new Date().toISOString()} ${arquivo} ${hash} ${ensaio ? 'ensaio' : 'aplicada'} ${outcome}\n`);
  }
}
