import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const requireNative = createRequire(import.meta.url);
const output = ts.transpileModule(readFileSync('src/components/fichas/AssinaturaRecepcaoModal.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
type Elemento = { type: unknown; props: Record<string, unknown> };

function harness() {
  const estados: unknown[] = ['assinar', 'ficha-sintetica', null, true];
  const refs: Array<{ current: unknown }> = [];
  const efeitos: Array<() => unknown> = [];
  const instancias: Pad[] = [];
  let indiceEstado = 0;
  let indiceRef = 0;
  const escalas: Array<[number, number]> = [];
  const canvas = { width: 300, height: 150, offsetWidth: 610, offsetHeight: 196,
    getContext: () => ({ scale: (x: number, y: number) => escalas.push([x, y]) }),
  };
  class Pad {
    empty = true;
    desligado = false;
    listeners = new Set<() => void>();
    constructor() { instancias.push(this); }
    isEmpty() { return this.empty; }
    clear() { this.empty = true; }
    off() { this.desligado = true; }
    addEventListener(_tipo: string, handler: () => void) { this.listeners.add(handler); }
    removeEventListener(_tipo: string, handler: () => void) { this.listeners.delete(handler); }
    desenhar() { this.empty = false; for (const handler of this.listeners) handler(); }
  }
  const jsx = (type: unknown, props: Record<string, unknown>): Elemento => ({ type, props });
  const loaded: { AssinaturaRecepcaoModal(props: object): Elemento } = runInNewContext(output + '\nexports;', {
    exports: {}, Date, window: { devicePixelRatio: 2 },
    require(name: string) {
      if (name === 'react') return {
        useRef(initial: unknown) { const i = indiceRef++; return refs[i] ?? (refs[i] = { current: initial }); },
        useState(initial: unknown) { const i = indiceEstado++; if (!(i in estados)) estados[i] = initial; return [estados[i], (value: unknown) => { estados[i] = value; }]; },
        useEffect(fn: () => unknown) { efeitos.push(fn); },
        useCallback(fn: unknown) { return fn; },
      };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'signature_pad') return { __esModule: true, default: Pad };
      if (name === 'motion/react') return { motion: { div: 'motion.div' }, AnimatePresence: 'AnimatePresence' };
      if (name === '@/components/ui/dialog') return { Dialog: 'Dialog', DialogContent: 'DialogContent' };
      if (name === 'date-fns' || name === 'date-fns/locale') return requireNative(name);
      return {};
    },
  });
  const render = () => {
    indiceEstado = 0; indiceRef = 0; efeitos.length = 0;
    return loaded.AssinaturaRecepcaoModal({ open: true, onOpenChange() {}, pacienteId: 'paciente-sintetico', pacienteNome: 'Paciente sintetico' });
  };
  function elementos(node: unknown): Elemento[] {
    if (Array.isArray(node)) return node.flatMap(elementos);
    if (!node || typeof node !== 'object' || !('props' in node)) return [];
    const el = node as Elemento;
    return [el, ...elementos(el.props.children)];
  }
  let tree = render();
  const canvasRef = elementos(tree).find((el) => el.type === 'canvas')!.props.ref as
    ((canvas: object | null) => unknown) | { current: unknown };
  // AnimatePresence wait: o efeito do novo step roda antes de o canvas entrar no DOM.
  // O primeiro efeito e a busca da ficha, fora deste recorte; os seguintes sao de inicializacao.
  for (const effect of efeitos.slice(1)) effect();
  let cleanup: unknown;
  const montar = () => {
    if (typeof canvasRef === 'function') cleanup = canvasRef(canvas);
    else canvasRef.current = canvas;
  };
  const desmontar = () => {
    if (typeof cleanup === 'function') cleanup();
    else if (typeof canvasRef === 'function') canvasRef(null);
    else canvasRef.current = null;
  };
  montar();
  const botao = (nome: string) => {
    tree = render();
    return elementos(tree).find((el) => el.type === 'button' && elementos(el).length > 0
      && JSON.stringify(el.props.children).includes(nome))!;
  };
  return { canvas, instancias, refs, escalas, montar, desmontar,
    confirmarDesabilitado: () => botao('Confirmar Assinatura').props.disabled,
    limpar: () => (botao('Limpar').props.onClick as () => void)(),
  };
}

test('DQ-REC-01: canvas montado depois do efeito inicializa e endStroke habilita confirmar', () => {
  const h = harness();
  assert.equal(h.instancias.length, 1);
  assert.equal(h.canvas.width, 1220);
  assert.equal(h.canvas.height, 392);
  assert.deepEqual(h.escalas, [[2, 2]]);
  assert.equal(h.confirmarDesabilitado(), true);
  h.instancias[0].desenhar();
  assert.equal(h.confirmarDesabilitado(), false);
});

test('DQ-REC-01: limpar desabilita confirmar e novo traco volta a habilitar', () => {
  const h = harness();
  assert.equal(h.instancias.length, 1);
  h.instancias[0].desenhar();
  h.limpar();
  assert.equal(h.instancias[0].isEmpty(), true);
  assert.equal(h.confirmarDesabilitado(), true);
  h.instancias[0].desenhar();
  assert.equal(h.confirmarDesabilitado(), false);
});

test('DQ-REC-01: desmontar remove listeners e reabrir cria pad vazio independente', () => {
  const h = harness();
  assert.equal(h.instancias.length, 1);
  const anterior = h.instancias[0];
  anterior.desenhar();
  h.desmontar();
  assert.equal(anterior.desligado, true);
  assert.equal(anterior.listeners.size, 0);
  assert(h.refs.every((ref) => ref.current == null));
  h.montar();
  assert.equal(h.instancias.length, 2);
  assert.equal(h.confirmarDesabilitado(), true);
  h.instancias[1].desenhar();
  assert.equal(h.confirmarDesabilitado(), false);
});
