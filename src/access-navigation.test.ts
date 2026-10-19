import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server';
import { resolverEstadoComercial } from './lib/billing/estado-comercial';

// Execute the actual entry points with isolated dependencies: no Auth, DB or Stripe calls.
function loadEntry(file: string, dependencies: Record<string, unknown>): Record<string, unknown> {
  const path = fileURLToPath(new URL(file, import.meta.url));
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const entryExports: Record<string, unknown> = {};
  runInNewContext(compiled.outputText, {
    exports: entryExports,
    URL,
    process: { env: { STRIPE_BILLING_ENABLED: 'true' } },
    require: (name: string): unknown => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: path });
  return entryExports;
}

async function runProxy(path: string, authenticated: boolean): Promise<NextResponse> {
  const refreshed = NextResponse.next();
  refreshed.cookies.set('audit-session', 'synthetic-refreshed', { httpOnly: true });
  const entry = loadEntry('./proxy.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/middleware': {
      updateSession: async () => ({
        response: refreshed,
        session: authenticated ? { id: 'synthetic-user' } : null,
      }),
    },
  });
  const proxy = entry.proxy as (request: NextRequest) => Promise<NextResponse>;
  return proxy(new NextRequest(`https://odontoia.app${path}`));
}

test('login permanece acessível com sessão existente e preserva o cookie renovado', async () => {
  const response = await runProxy('/login', true);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.cookies.get('audit-session')?.value, 'synthetic-refreshed');
});

test('dashboard sem sessão continua protegido e conserva o destino de retorno', async () => {
  const response = await runProxy('/dashboard', false);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://odontoia.app/login?redirectTo=%2Fdashboard');
  assert.equal(response.cookies.get('audit-session')?.value, 'synthetic-refreshed');
});

test('login anônimo, redefinição de senha e dashboard autenticado continuam acessíveis', async () => {
  for (const [path, authenticated] of [['/login', false], ['/redefinir-senha', true], ['/dashboard', true]] as const) {
    assert.equal((await runProxy(path, authenticated)).status, 200);
  }
});

class RouteRedirect extends Error {
  constructor(readonly destination: string) { super(destination); }
}

interface AccessFixture {
  subscription: string | null;
  exempt?: boolean;
  formationAllowed?: boolean;
  role?: 'admin' | 'dentista' | 'secretaria';
  clinicStatus?: string;
}

async function dashboardDestination(fixture: AccessFixture): Promise<string> {
  const service = {
    from(table: string) {
      assert.ok(['clinicas', 'assinaturas_dentista'].includes(table));
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: table === 'clinicas'
          ? { status_elegibilidade: fixture.clinicStatus ?? 'elegivel' }
          : fixture.subscription ? { status: fixture.subscription } : null }),
      };
      return query;
    },
  };
  const entry = loadEntry('./app/dashboard/layout.tsx', {
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    'next/navigation': { redirect: (destination: string): never => { throw new RouteRedirect(destination); } },
    'next/headers': { headers: async () => new Headers({ 'x-pathname': '/dashboard' }) },
    '@/server/auth/clinic': { requireClinicContext: async () => ({ clinicId: 'synthetic-clinic', user: { id: 'synthetic-user' }, supabase: service }) },
    '@/lib/get-dentista': { getDentistaCached: async () => ({ id: 'synthetic-dentist', role: fixture.role ?? 'dentista' }) },
    '@/components/layout/dashboard-shell': { DashboardShell: 'test-shell' },
    './_components/welcome-modal': { WelcomeModal: 'test-welcome' },
    '@/lib/supabase/service': { createServiceClient: () => service },
    '@/lib/billing/exemptions': { clinicaIsentaDeCobranca: () => fixture.exempt ?? false },
    '@/lib/billing/estado-comercial': { resolverEstadoComercial },
    '@/server/services/formacao-clinica': { obterAcessoFormacaoClinica: async () => ({ liberado: fixture.formationAllowed ?? false }) },
  });
  const layout = entry.default as (props: { children: null }) => Promise<unknown>;
  try {
    await layout({ children: null });
    return '/dashboard';
  } catch (error) {
    if (error instanceof RouteRedirect) return error.destination;
    throw error;
  }
}

for (const subscription of ['aguardando_formacao', 'checkout_pendente', 'cartao_pronto']) {
  test(`vínculo já ativo com ${subscription} termina em planos, sem voltar à página de vínculo pendente`, async () => {
    assert.equal(await dashboardDestination({ subscription }), '/planos?billing=required');
  });
}

test('assinatura válida, isenção e formação autorizada preservam acesso', async () => {
  for (const subscription of ['active', 'trialing', 'past_due']) {
    assert.equal(await dashboardDestination({ subscription }), '/dashboard');
  }
  assert.equal(await dashboardDestination({ subscription: 'checkout_pendente', exempt: true }), '/dashboard');
  assert.equal(await dashboardDestination({ subscription: 'cartao_pronto', formationAllowed: true }), '/dashboard');
});

test('assinatura ausente/inadimplente não recebe acesso por causa da correção', async () => {
  for (const subscription of [null, 'unpaid', 'suspended', 'canceled']) {
    assert.equal(await dashboardDestination({ subscription }), '/planos?billing=required');
  }
});

test('bloqueio da clínica continua prevalecendo sobre assinatura válida', async () => {
  assert.equal(await dashboardDestination({ subscription: 'active', clinicStatus: 'bloqueada' }), '/dashboard/configuracoes?aba=clinica');
});

test('destino planos encerra o fluxo dos três estados que causavam o ciclo', async () => {
  for (const status of ['aguardando_formacao', 'checkout_pendente', 'cartao_pronto']) {
    assert.equal(await dashboardDestination({ subscription: status }), '/planos?billing=required');
    const service = {
      from(table: string) {
        const records: Record<string, unknown> = {
          users: { active_clinica_id: 'synthetic-clinic' },
          clinicas: { status_assinatura: 'trial', trial_ends_at: null },
          assinaturas_dentista: { status },
          politicas_trial_assinatura: { dias_trial: 7 },
        };
        assert.ok(table in records);
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: records[table] }),
        };
        return query;
      },
    };
    const entry = loadEntry('./app/planos/page.tsx', {
      'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }) },
      'next/navigation': { redirect: (destination: string): never => { throw new RouteRedirect(destination); } },
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'synthetic-user' } } }) } }) },
      '@/lib/supabase/service': { createServiceClient: () => service },
      '@/lib/billing/exemptions': { clinicaIsentaDeCobranca: () => false },
      '@/lib/billing/estado-comercial': { resolverEstadoComercial },
      './_components/planos-client': { PlanosClient: 'test-plans' },
    });
    const page = entry.default as (props: { searchParams: Promise<Record<string, string>> }) => Promise<{ type: string }>;
    const rendered = await page({ searchParams: Promise.resolve({}) });
    assert.equal(rendered.type, 'test-plans');
  }
});
