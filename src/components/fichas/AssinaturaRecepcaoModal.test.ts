import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const requireNative = createRequire(import.meta.url);
const source = readFileSync('src/components/fichas/AssinaturaRecepcaoModal.tsx', 'utf8');
// Expoe os handlers reais para aguardar rejeicoes, sem o void do onClick.
const instrumentada = source.replace('  const hoje =', `  __handlers.current = { confirmar: handleConfirmar, tentar: typeof handleTentarNovamente === 'function' ? handleTentarNovamente : async () => setStep('assinar') };\n  const hoje =`);
const output = ts.transpileModule(instrumentada, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
type Elemento = { type: unknown; props: Record<string, unknown> };

type ResultadoAssinatura = { ok: boolean; error?: string };
function harness(options: {
  salvar?: () => Promise<ResultadoAssinatura>;
  buscar?: () => Promise<{ fichaId: string | null; error?: string }>;
} = {}) {
  const estados: unknown[] = ['assinar', 'ficha-sintetica', null, true];
  const refs: Array<{ current: unknown }> = [];
  const efeitos: Array<() => unknown> = [];
  const instancias: Pad[] = [];
  const __handlers: { current?: { confirmar: () => Promise<void>; tentar: () => Promise<void> } } = {};
  const envios: unknown[][] = [];
  let consultas = 0;
  let sucessos = 0;
  const fechamentos: boolean[] = [];
  const timers: Array<() => void> = [];
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
    toDataURL() { return 'data:image/png;base64,UUE='; }
    clear() { this.empty = true; }
    off() { this.desligado = true; }
    addEventListener(_tipo: string, handler: () => void) { this.listeners.add(handler); }
    removeEventListener(_tipo: string, handler: () => void) { this.listeners.delete(handler); }
    desenhar() { this.empty = false; for (const handler of this.listeners) handler(); }
  }
  const jsx = (type: unknown, props: Record<string, unknown>): Elemento => ({ type, props });
  const loaded: { AssinaturaRecepcaoModal(props: object): Elemento } = runInNewContext(output + '\nexports;', {
    exports: {}, __handlers, Date, setTimeout: (fn: () => void) => { timers.push(fn); }, window: { devicePixelRatio: 2 },
    require(name: string) {
      if (name === 'react') return {
        useRef(initial: unknown) { const i = indiceRef++; return refs[i] ?? (refs[i] = { current: initial }); },
        useState(initial: unknown) { const i = indiceEstado++; if (!(i in estados)) estados[i] = initial; return [estados[i], (value: unknown) => { estados[i] = value; }]; },
        useEffect(fn: () => unknown) { efeitos.push(fn); },
        useCallback(fn: unknown) { return fn; },
      };
      if (name === '@/app/dashboard/agendamentos/assinatura-actions') return {
        salvarAssinaturaRecepcao: async (...args: unknown[]) => { envios.push(args); return options.salvar ? options.salvar() : { ok: true }; },
        buscarFichaParaAssinar: async () => { consultas++; return options.buscar ? options.buscar() : { fichaId: 'ficha-sintetica' }; },
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
    return loaded.AssinaturaRecepcaoModal({ open: true, onOpenChange(open: boolean) { fechamentos.push(open); }, onSigned() { sucessos++; }, pacienteId: 'paciente-sintetico', pacienteNome: 'Paciente sintetico' });
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
  return { canvas, instancias, refs, escalas, montar, desmontar, envios, fechamentos, timers,
    estado: () => estados[0], erro: () => estados[2], consultas: () => consultas, sucessos: () => sucessos,
    confirmar: () => { render(); return __handlers.current!.confirmar(); },
    tentar: () => { render(); return __handlers.current!.tentar(); },
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
  assert(!h.refs.some((ref) => ref.current === anterior));
  h.montar();
  assert.equal(h.instancias.length, 2);
  assert.equal(h.confirmarDesabilitado(), true);
  h.instancias[1].desenhar();
  assert.equal(h.confirmarDesabilitado(), false);
});


test('DQ-REC-02: rejeicao de rede sai de salvando com erro e sem retry automatico', async () => {
  const h = harness({ salvar: async () => { throw new TypeError('Failed to fetch'); } });
  h.instancias[0].desenhar();
  await assert.doesNotReject(h.confirmar());
  assert.equal(h.estado(), 'erro');
  assert.equal(h.envios.length, 1);
  assert.equal(h.consultas(), 0);
  assert.equal(h.sucessos(), 0);
  assert.equal(h.timers.length, 0);
  assert.deepEqual(h.fechamentos, []);
  assert(!String(h.erro()).includes('Failed to fetch'));
  // Um clique repetido no botao antigo durante a animacao nao reenvia a action.
  await h.confirmar();
  assert.equal(h.envios.length, 1);
});

test('DQ-REC-02: tentar novamente reconsulta a mesma ficha e exige novo gesto/confirmacao', async () => {
  let tentativa = 0;
  const h = harness({ salvar: async () => { if (++tentativa === 1) throw new TypeError('Failed to fetch'); return { ok: true }; } });
  h.instancias[0].desenhar();
  await assert.doesNotReject(h.confirmar());
  await h.tentar();
  assert.equal(h.consultas(), 1);
  assert.equal(h.estado(), 'assinar');
  assert.equal(h.envios.length, 1);
  h.desmontar(); h.montar();
  assert.equal(h.confirmarDesabilitado(), true);
  await h.confirmar();
  assert.equal(h.envios.length, 1);
  h.instancias.at(-1)!.desenhar();
  await h.confirmar();
  assert.equal(h.envios.length, 2);
  assert.equal(h.estado(), 'sucesso');
  assert.equal(h.sucessos(), 1);
  assert.equal(h.timers.length, 1);
});

for (const elegivel of [null, 'outra-ficha']) {
  test(`DQ-REC-02: resposta perdida apos persistir nao reenvia se consulta retorna ${elegivel}`, async () => {
    let persistencias = 0;
    const h = harness({
      salvar: async () => { persistencias++; throw new TypeError('Failed to fetch'); },
      buscar: async () => ({ fichaId: elegivel }),
    });
    h.instancias[0].desenhar();
    await assert.doesNotReject(h.confirmar());
    await h.tentar();
    assert.equal(h.consultas(), 1);
    assert.equal(h.estado(), 'erro');
    await h.confirmar();
    assert.equal(h.envios.length, 1);
    assert.equal(persistencias, 1);
    assert.equal(h.sucessos(), 0);
  });
}

test('DQ-REC-02: falha na reconsulta continua recuperavel sem reenviar assinatura', async () => {
  const h = harness({
    salvar: async () => { throw new TypeError('Failed to fetch'); },
    buscar: async () => { throw new TypeError('Failed to fetch'); },
  });
  h.instancias[0].desenhar();
  await assert.doesNotReject(h.confirmar());
  await assert.doesNotReject(h.tentar());
  assert.equal(h.estado(), 'erro');
  assert.equal(h.envios.length, 1);
  assert.equal(h.sucessos(), 0);
});

test('DQ-REC-02: dois cliques simultaneos geram somente uma chamada', async () => {
  let resolver: ((result: ResultadoAssinatura) => void) | undefined;
  const pendente = new Promise<ResultadoAssinatura>((resolve) => { resolver = resolve; });
  const h = harness({ salvar: () => pendente });
  h.instancias[0].desenhar();
  const primeira = h.confirmar();
  const segunda = h.confirmar();
  resolver!({ ok: true });
  await Promise.all([primeira, segunda]);
  assert.equal(h.envios.length, 1);
  assert.equal(h.sucessos(), 1);
  assert.equal(h.estado(), 'sucesso');
});

test('DQ-REC-02: erro retornado/REC-4 preserva mensagem e fluxo existente de tentar', async () => {
  const mensagem = '1 procedimento assinado; encaminhado continua pendente.';
  const h = harness({ salvar: async () => ({ ok: false, error: mensagem }) });
  h.instancias[0].desenhar();
  await h.confirmar();
  assert.equal(h.estado(), 'erro');
  assert.equal(h.erro(), mensagem);
  await h.tentar();
  assert.equal(h.consultas(), 0);
  assert.equal(h.estado(), 'assinar');
  assert.equal(h.envios.length, 1);
});
