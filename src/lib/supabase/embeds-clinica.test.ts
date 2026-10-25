import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

// A M0 preserva as FKs simples e adiciona outra relacao entre os mesmos pares.
// Conferir selects reais (inclusive templates/embeds aninhados e inversos), sem rede.
const relacoes: Array<[string, string, string]> = [
  ['atendimentos_clinicos', 'pacientes', 'atendimentos_clinicos_paciente_id_fkey'],
  ['atendimentos_clinicos', 'agendamentos', 'atendimentos_clinicos_agendamento_id_fkey'],
  ['atendimentos_clinicos', 'dentistas', 'atendimentos_clinicos_dentista_id_fkey'],
  ['fichas', 'pacientes', 'fichas_paciente_id_fkey'],
  ['fichas', 'dentistas', 'fichas_dentista_id_fkey'],
  ['ficha_evolucoes', 'fichas', 'ficha_evolucoes_ficha_id_fkey'],
  ['ficha_evolucoes', 'atendimentos_clinicos', 'ficha_evolucoes_atendimento_id_fkey'],
  ['ficha_evolucoes', 'dentistas', 'ficha_evolucoes_dentista_id_fkey'],
  ['odontograma_eventos', 'pacientes', 'odontograma_eventos_paciente_id_fkey'],
  ['odontograma_eventos', 'fichas', 'odontograma_eventos_ficha_id_fkey'],
  ['odontograma_eventos', 'dentistas', 'odontograma_eventos_dentista_id_fkey'],
  ['odontograma_eventos', 'dentistas', 'odontograma_eventos_encaminhado_para_fkey'],
  ['agendamentos', 'pacientes', 'agendamentos_paciente_id_fkey'],
  ['agendamentos', 'dentistas', 'agendamentos_dentista_id_fkey'],
  ['agendamentos', 'dentistas', 'agendamentos_created_by_fkey'],
  ['agendamentos', 'atendimentos_clinicos', 'agendamentos_atendimento_origem_id_fkey'],
];
const permitidas = new Map<string, Set<string>>();
for (const [origem, destino, fk] of relacoes) {
  for (const chave of [`${origem}:${destino}`, `${destino}:${origem}`]) {
    const nomes = permitidas.get(chave) ?? new Set<string>();
    nomes.add(fk);
    permitidas.set(chave, nomes);
  }
}

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const caminho = join(dir, entry.name);
    return entry.isDirectory() ? arquivos(caminho)
      : /\.tsx?$/.test(caminho) && !/\.test\.tsx?$/.test(caminho) ? [caminho] : [];
  });
}

function verificarEmbeds(select: string, origem: string, local: string, falhas: string[]): number {
  let verificados = 0;
  for (let i = 0, inicio = 0; i < select.length; i++) {
    if (select[i] === ',') { inicio = i + 1; continue; }
    if (select[i] !== '(') continue;
    const cabecalho = select.slice(inicio, i).trim();
    let profundidade = 1;
    let fim = i + 1;
    for (; fim < select.length && profundidade; fim++) {
      if (select[fim] === '(') profundidade++;
      if (select[fim] === ')') profundidade--;
    }
    const [destino, ...hints] = cabecalho.split(':').at(-1)!.split('!');
    const nomes = permitidas.get(`${origem}:${destino}`);
    if (nomes) {
      verificados++;
      if (!hints.some((hint) => nomes.has(hint))) falhas.push(`${local}: ${origem} -> ${cabecalho}`);
    }
    verificados += verificarEmbeds(select.slice(i + 1, fim - 1), destino, local, falhas);
    i = fim - 1;
    inicio = fim;
  }
  return verificados;
}

test('selects do app desambiguam as relacoes duplicadas pela M0 com nome da FK', () => {
  const falhas: string[] = [];
  let verificados = 0;
  for (const arquivo of arquivos('src')) {
    const source = ts.createSourceFile(arquivo, readFileSync(arquivo, 'utf8'), ts.ScriptTarget.Latest, true);
    const constantes = new Map<string, ts.Expression>();
    function coletar(node: ts.Node): void {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) constantes.set(node.name.text, node.initializer);
      ts.forEachChild(node, coletar);
    }
    coletar(source);
    function valor(node: ts.Expression | undefined, visitadas = new Set<string>()): string | null {
      if (!node) return null;
      if (ts.isStringLiteralLike(node)) return node.text;
      if (ts.isIdentifier(node) && !visitadas.has(node.text)) {
        return valor(constantes.get(node.text), new Set([...visitadas, node.text]));
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const a = valor(node.left, visitadas);
        const b = valor(node.right, visitadas);
        return a != null && b != null ? a + b : null;
      }
      if (ts.isTemplateExpression(node)) {
        let texto = node.head.text;
        for (const span of node.templateSpans) {
          const parte = valor(span.expression, visitadas);
          if (parte == null) return null;
          texto += parte + span.literal.text;
        }
        return texto;
      }
      return null;
    }
    function tabela(node: ts.Expression): string | null {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        return node.expression.name.text === 'from' ? valor(node.arguments[0]) : tabela(node.expression.expression);
      }
      if (ts.isPropertyAccessExpression(node)) return tabela(node.expression);
      return null;
    }
    function visitar(node: ts.Node): void {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'select') {
        const origem = tabela(node.expression.expression);
        const select = valor(node.arguments[0]);
        const local = `${relative('.', arquivo)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
        if (origem && select) verificados += verificarEmbeds(select, origem, local, falhas);
        if (origem && node.arguments.length && select == null) falhas.push(`${local}: select nao resolvido para ${origem}`);
      }
      ts.forEachChild(node, visitar);
    }
    visitar(source);
  }
  assert(verificados > 30, 'A varredura deve cobrir os consumidores reais, inclusive templates.');
  assert.deepEqual(falhas, [], `Embeds sem hint de FK:\n${falhas.join('\n')}`);
});
