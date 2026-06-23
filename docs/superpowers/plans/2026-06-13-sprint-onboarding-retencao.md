# Sprint: Onboarding & Retenção — Plano de Implementação

**Data:** 2026-06-13  
**Objetivo:** Reduzir TTV (Time to Value), estruturar onboarding ativador e proteger receita com downgrade no D14.

---

## Contexto

O principal ativo do Odonto.IA é a ficha clínica gerada pelo Modo Consulta. O problema atual: o dentista recém-cadastrado não tem como experimentar o Modo Consulta sem antes cadastrar paciente, criar agendamento e navegar pelo sistema. Esse atrito mata a ativação.

Este sprint resolve isso em camadas:

1. **Rota `/consulta/demo`** — dentista entra no Modo Consulta com paciente mockado, vê a IA em ação, sem cadastrar nada
2. **Tour DEX → Demo** — step MODO_CONSULTA do tour agora tem CTA direto para o demo
3. **Tela de procedimentos no onboarding** — step novo entre setup e dashboard
4. **Email D0** — boas-vindas disparado automaticamente no cadastro
5. **Migração `fichas.origem`** — aplicar no banco (arquivo já criado)
6. **Downgrade D14** — bloquear Modo Consulta quando trial expira

---

## Arquivos

| Arquivo | Tipo |
|---|---|
| `supabase/migrations/20260613000001_074_fichas_origem.sql` | Aplicar (existe) |
| `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` | Modificar |
| `src/app/consulta/demo/page.tsx` | Criar |
| `src/components/onboarding/dex-onboarding.tsx` | Modificar |
| `src/app/onboarding/_components/onboarding-client.tsx` | Modificar |
| `src/app/onboarding/actions.ts` | Modificar |
| `src/app/consulta/[agendamentoId]/page.tsx` | Modificar (D14) |

---

## Task 1: Aplicar migração fichas.origem no Supabase

**Arquivo:** `supabase/migrations/20260613000001_074_fichas_origem.sql` (já existe)

**O que fazer:**  
Aplicar a migração via CLI ou dashboard do Supabase. O arquivo já está em disco.

**Via CLI (PowerShell na raiz do projeto):**
```powershell
npx supabase db push
```

**Via dashboard (alternativa):**  
Acessar Supabase Dashboard → SQL Editor → colar e executar:
```sql
ALTER TABLE fichas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual'
  CHECK (origem IN ('modo_consulta', 'manual'));

COMMENT ON COLUMN fichas.origem IS 'Origem da ficha: modo_consulta (DEX) ou manual';
```

**Verificação:**
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'fichas' AND column_name = 'origem';
```

---

## Task 2: Adaptar ConsultaClient para modo demo (prop isDemo)

**Arquivo:** `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`

### 2.1 — Adicionar isDemo à interface ConsultaClientProps

Localizar (linha ~45):
```ts
interface ConsultaClientProps {
  agendamentoId: string;
```

Substituir por:
```ts
interface ConsultaClientProps {
  agendamentoId: string;
  isDemo?: boolean;
```

### 2.2 — Adicionar isDemo ao destructuring da função

Localizar (linha ~103):
```ts
export function ConsultaClient({
  agendamentoId,
  paciente,
  hora,
  observacoesAgendamento,
  ultimaQueixa,
  ultimasAnotacoes,
  fichas,
  orcamentos,
  agendamentoStatus,
  alertasClinicos,
  procedimentosClinica,
  planejamento,
}: ConsultaClientProps) {
```

Substituir por:
```ts
export function ConsultaClient({
  agendamentoId,
  isDemo = false,
  paciente,
  hora,
  observacoesAgendamento,
  ultimaQueixa,
  ultimasAnotacoes,
  fichas,
  orcamentos,
  agendamentoStatus,
  alertasClinicos,
  procedimentosClinica,
  planejamento,
}: ConsultaClientProps) {
```

### 2.3 — Adaptar handleSalvar para modo demo

Localizar (linha ~222):
```ts
  const handleSalvar = async () => {
    if (!evolucao) return;
    setIsSaving(true);
```

Substituir o corpo completo de `handleSalvar` (do `setIsSaving(true)` até o final do `setInterval`):
```ts
  const handleSalvar = async () => {
    if (!evolucao) return;
    setIsSaving(true);

    if (isDemo) {
      // Modo demo: simula salvamento sem persistir no banco
      await new Promise(r => setTimeout(r, 800));
      setSaved(true);
      setSavedFichaId('demo');
      setIsSaving(false);
      return;
    }

    const dentesConfirmados = confirmedTeeth;
    const anotacoesFinais = evolucao.alerta_novo
      ? `${evolucao.anotacoes}\n\n⚠️ Novo alerta detectado: ${evolucao.alerta_novo}`
      : evolucao.anotacoes;

    const result = await salvarFichaConsulta({
      agendamentoId,
      pacienteId:         paciente.id,
      queixa_principal:   evolucao.queixa_principal,
      anotacoes:          anotacoesFinais,
      dentes_afetados:    dentesConfirmados,
      dentes_observacoes: evolucao.dentes_observacoes,
      procedimentos:      evolucao.procedimentos,
      conduta:            evolucao.conduta,
      retorno_sugerido:   evolucao.retorno_sugerido,
      alerta_novo:        evolucao.alerta_novo,
    });
    if (result.error) { toast.error(result.error); setIsSaving(false); return; }
    if (result.fichaId) setSavedFichaId(result.fichaId);
    setSaved(true);
    setSaveCountdown(5);
    countdownRef.current = setInterval(() => {
      setSaveCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          router.push(`/dashboard/pacientes/${paciente.id}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
```

### 2.4 — Adaptar handleIniciarAtendimento para modo demo

Localizar (linha ~264):
```ts
  const handleIniciarAtendimento = async () => {
    setIsIniciando(true);
    const result = await iniciarAtendimentoConsulta(agendamentoId);
```

Substituir por:
```ts
  const handleIniciarAtendimento = async () => {
    if (isDemo) {
      setAptStatus('in_progress');
      return;
    }
    setIsIniciando(true);
    const result = await iniciarAtendimentoConsulta(agendamentoId);
```

### 2.5 — Badge de demonstração no header e CTA pós-salvo no modo demo

**Header (linha ~295 aproximadamente):**  
Localizar o `<span>` que mostra o horário:
```tsx
          <span className="font-mono text-xs text-text-secondary bg-surface-alt px-2 py-0.5 rounded-md">{hora}</span>
```

Substituir por:
```tsx
          {isDemo ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: 'color-mix(in srgb, var(--color-teal) 15%, transparent)', color: 'var(--color-teal)' }}>
              Demonstração
            </span>
          ) : (
            <span className="font-mono text-xs text-text-secondary bg-surface-alt px-2 py-0.5 rounded-md">{hora}</span>
          )}
```

**CTA pós-salvo (procurar o bloco que renderiza `saved === true` no JSX):**  
O bloco mostra "Consultando..." com countdown. No modo demo, deve mostrar mensagem diferente sem countdown. Procurar no JSX algo como `{saved && (` ou o estado de sucesso após salvar e adicionar:

```tsx
{saved && isDemo && (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="fixed inset-0 bg-bg/95 backdrop-blur-sm flex items-center justify-center z-50"
  >
    <div className="text-center max-w-sm px-8">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{ background: 'color-mix(in srgb, var(--color-teal) 15%, transparent)' }}>
        <Check className="w-8 h-8" style={{ color: 'var(--color-teal)' }} />
      </div>
      <h2 className="font-heading text-2xl text-text-primary mb-2">
        Você viu o DEX em ação.
      </h2>
      <p className="text-text-secondary text-sm mb-6 leading-relaxed">
        A ficha foi estruturada automaticamente. Na prática, ela seria salva no prontuário do paciente.
      </p>
      <a
        href="/dashboard/agendamentos"
        className="inline-flex items-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white px-6 py-3 rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all"
      >
        Fazer minha primeira consulta real
      </a>
      <p className="text-xs text-text-secondary mt-4">
        Ou <a href="/dashboard" className="underline underline-offset-2">ir para o dashboard</a>
      </p>
    </div>
  </motion.div>
)}
```

> **Nota:** O bloco `{saved && !isDemo && (...)}` deve continuar existindo com o countdown original. Garantir que o bloco de sucesso normal só apareça quando `!isDemo`.

---

## Task 3: Criar rota /consulta/demo

**Arquivo:** `src/app/consulta/demo/page.tsx` (novo)

```tsx
import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { ConsultaClient } from '../[agendamentoId]/_components/consulta-client';

export default async function ConsultaDemoPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  return (
    <ConsultaClient
      isDemo
      agendamentoId="demo"
      paciente={{
        id: 'demo',
        nome: 'João Silva (Demonstração)',
        idadeStr: '42 anos',
        observacoes: null,
      }}
      hora="09:00"
      observacoesAgendamento="Paciente relata dor ao mastigar no lado direito inferior."
      ultimaQueixa="Dor no molar inferior direito — última consulta há 3 meses"
      ultimasAnotacoes="Restauração de compósito no dente 46. Orientado sobre higiene interdental."
      fichas={[{
        data: '10/03/2026',
        queixa: 'Dor ao morder no lado direito',
        anotacoes: 'Restauração de compósito no dente 46. Boa adaptação.',
        dentes: [46],
        procedimentos: ['Restauração de compósito'],
      }]}
      orcamentos={[]}
      agendamentoStatus="scheduled"
      alertasClinicos={[]}
      procedimentosClinica={[]}
      planejamento={null}
    />
  );
}
```

> **Por que cirúrgico:** A rota `/consulta/demo` tem prioridade sobre `[agendamentoId]` no Next.js App Router por ser estática. Não precisa de nenhuma mudança no roteamento — só criar o arquivo na pasta certa.

---

## Task 4: Atualizar DEX tour — step MODO_CONSULTA com CTA para demo

**Arquivo:** `src/components/onboarding/dex-onboarding.tsx`

O step `MODO_CONSULTA` (linha ~252) tem `simulacao: 'modoConsulta'` que renderiza `SimModoConsulta`. A mudança é: adicionar um CTA "Entrar no modo demo" que leva para `/consulta/demo` diretamente da bolha do tour.

### 4.1 — Adicionar campo `cta` à interface TourStep

Localizar (linha ~29):
```ts
interface TourStep {
  id: StepId;
  path: string;
  title: string;
  description: string;
  targetId?: string;
  simulacao?: 'agendamento' | 'perfilPaciente' | 'orcamento' | 'bot' | 'financeiro' | 'modoConsulta';
  details?: string;
  bullets?: string[];
}
```

Substituir por:
```ts
interface TourStep {
  id: StepId;
  path: string;
  title: string;
  description: string;
  targetId?: string;
  simulacao?: 'agendamento' | 'perfilPaciente' | 'orcamento' | 'bot' | 'financeiro' | 'modoConsulta';
  details?: string;
  bullets?: string[];
  demoCta?: { label: string; href: string };
}
```

### 4.2 — Adicionar demoCta ao step MODO_CONSULTA

Localizar (linha ~252):
```ts
    const modoConsultaStep: TourStep = {
      id: 'MODO_CONSULTA',
      path: '/dashboard',
      title: 'A IA que escreve enquanto você trata',
      description: 'Fale normalmente durante a consulta. O Odonto.IA transcreve, identifica os dentes, estrutura a ficha e prepara o orçamento — antes de você terminar de atender.',
      bullets: [
        'Sem digitar — você fala, a IA registra',
        'Dentes marcados automaticamente no odontograma',
        'Ficha estruturada: diagnóstico, procedimentos, observações',
        'Orçamento gerado direto da ficha, em segundos',
      ],
      simulacao: 'modoConsulta' as const,
```

Adicionar após `simulacao: 'modoConsulta' as const,`:
```ts
      demoCta: { label: '→ Experimentar agora', href: '/consulta/demo' },
```

### 4.3 — Renderizar o demoCta na bolha do tour

Procurar onde o `step.description` e `step.bullets` são renderizados na bolha (dentro do componente de bubble/tooltip). Após o bloco de bullets, adicionar:

```tsx
{step.demoCta && (
  <a
    href={step.demoCta.href}
    className="mt-3 flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl w-full justify-center"
    style={{
      background: 'color-mix(in srgb, var(--color-teal) 15%, transparent)',
      color: 'var(--color-teal)',
    }}
  >
    {step.demoCta.label}
  </a>
)}
```

> **Onde fica:** A bolha do tour é renderizada dentro do `DexOnboarding` component — procurar o JSX que tem `step.description` e `step.bullets?.map(...)`. O `demoCta` vai logo depois dos bullets, antes do botão "Próximo".

---

## Task 5: Tela de procedimentos no onboarding

**Arquivo:** `src/app/onboarding/_components/onboarding-client.tsx`

### 5.1 — Adicionar 'procedimentos' ao tipo de step

Localizar (linha ~102):
```ts
  const [step, setStep] = useState<'plano' | 'form' | 'sucesso'>('plano');
```

Substituir por:
```ts
  const [step, setStep] = useState<'plano' | 'form' | 'procedimentos' | 'sucesso'>('plano');
```

### 5.2 — Adicionar import do useRouter

No topo do arquivo, após os imports existentes:
```ts
import { useRouter } from 'next/navigation';
```

E dentro do componente, após os outros hooks:
```ts
  const router = useRouter();
```

### 5.3 — Mudar destino do submit para 'procedimentos'

Localizar (linha ~140):
```ts
      if (result.success) {
        setNome(data.nome.split(' ')[0]);
        setStep('sucesso');
      }
```

Substituir por:
```ts
      if (result.success) {
        setNome(data.nome.split(' ')[0]);
        setStep('procedimentos');
      }
```

### 5.4 — Adicionar bloco AnimatePresence para step 'procedimentos'

Inserir ANTES do bloco `{step === 'sucesso' && (` (aproximadamente linha ~425):

```tsx
        {/* ── ETAPA 1.5 — Procedimentos ── */}
        {step === 'procedimentos' && (
          <motion.div
            key="procedimentos"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-center mb-8">
              <div
                className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5"
                style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
              >
                <Settings className="w-7 h-7" style={{ color: 'var(--color-teal)' }} />
              </div>
              <h1 className="font-heading text-3xl text-text-primary mb-2">
                Seus procedimentos
              </h1>
              <p className="text-text-secondary text-sm leading-relaxed max-w-sm mx-auto">
                Já cadastramos uma tabela padrão com os procedimentos mais comuns. Você pode usar agora e ajustar depois, ou importar sua própria tabela.
              </p>
            </div>

            <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden p-6 mb-4">
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
                >
                  <Check className="w-4 h-4" style={{ color: 'var(--color-teal)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-0.5">Tabela padrão incluída</p>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Restaurações, exodontias, implantes, limpeza e mais 20 procedimentos prontos para uso.
                  </p>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Você pode adicionar, editar ou remover procedimentos a qualquer momento em{' '}
                <span className="font-semibold text-text-primary">Configurações → Procedimentos</span>.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setStep('sucesso')}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)]"
              >
                Usar tabela padrão <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => router.push('/dashboard/configuracoes?aba=procedimentos')}
                className="w-full flex items-center justify-center gap-2 border border-border bg-surface hover:bg-surface-alt text-text-primary py-3.5 rounded-xl font-bold text-sm transition-all"
              >
                Importar minha tabela
              </button>
            </div>
          </motion.div>
        )}
```

---

## Task 6: Email D0 disparado no cadastro

**Arquivo:** `src/app/onboarding/actions.ts`

### 6.1 — Adicionar import

No topo do arquivo, após os imports existentes:
```ts
import { enviarEmailD0 } from '@/server/services/onboarding-emails';
```

### 6.2 — Disparar email após sucesso da RPC

Localizar (linha ~79):
```ts
  return { success: true };
```

Substituir por:
```ts
  if (user.email) {
    void enviarEmailD0({
      email: user.email,
      nomeDentista: data.nome.trim().split(' ')[0],
    });
  }

  return { success: true };
```

> **Por que `void`:** `enviarEmailD0` já tem try/catch interno. Usar `void` garante que a Action não espere o email antes de retornar — o dentista entra no sistema sem delay. Se o email falhar, apenas loga no servidor.

---

## Task 7: Downgrade D14 — bloquear Modo Consulta com trial expirado

**Arquivo:** `src/app/consulta/[agendamentoId]/page.tsx`

O campo `status_assinatura` (retornado por `getDentistaCached`) pode ser `'trial' | 'ativo' | 'inativo'`. O campo `trial_ends_at` é uma `timestamptz`.

### 7.1 — Adicionar verificação de trial na página da consulta

Localizar (linha ~9):
```ts
export default async function ConsultaPage({ params }: Props) {
  const { agendamentoId } = await params;
  const { supabase, clinicId } = await requireClinicContext();
```

Substituir por:
```ts
export default async function ConsultaPage({ params }: Props) {
  const { agendamentoId } = await params;
  const { supabase, clinicId } = await requireClinicContext();

  // Bloquear acesso se trial expirou e assinatura não está ativa
  const { data: clinica } = await supabase
    .from('clinicas')
    .select('status_assinatura, trial_ends_at')
    .eq('id', clinicId)
    .maybeSingle<{ status_assinatura: string; trial_ends_at: string | null }>();

  const trialExpirou =
    clinica?.status_assinatura === 'trial' &&
    clinica?.trial_ends_at != null &&
    new Date(clinica.trial_ends_at) < new Date();

  const assinaturaInativa = clinica?.status_assinatura === 'inativo';

  if (trialExpirou || assinaturaInativa) {
    redirect('/dashboard?bloqueado=modo-consulta');
  }
```

### 7.2 — Banner de aviso no dashboard quando bloqueado

**Arquivo:** `src/app/dashboard/page.tsx` (ou o layout do dashboard)

Verificar se `searchParams.bloqueado === 'modo-consulta'` e renderizar um banner/modal de upgrade.

**Estrutura básica do banner (adicionar ao componente da página do dashboard):**

```tsx
{searchParams.bloqueado === 'modo-consulta' && (
  <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-start gap-4">
    <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
      <AlertTriangle className="w-4 h-4 text-amber-500" />
    </div>
    <div className="flex-1">
      <p className="text-sm font-bold text-text-primary mb-0.5">Período de trial encerrado</p>
      <p className="text-xs text-text-secondary leading-relaxed">
        O Modo Consulta está disponível somente nos planos pagos. Suas fichas e histórico continuam acessíveis.
      </p>
    </div>
    <a
      href="/configuracoes/plano"
      className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-teal to-teal-lt text-white text-xs font-bold shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all"
    >
      Assinar agora
    </a>
  </div>
)}
```

> **Nota:** Verificar assinatura do `page.tsx` do dashboard para saber se é async e como acessar `searchParams`. No Next.js 15 App Router, `searchParams` é uma Promise e precisa de `await`.

---

## Ordem de execução sugerida

```
Task 1 → Aplicar migração (independente, sem risco)
Task 6 → Email D0 (2 min, alto impacto imediato)
Task 2 → isDemo no ConsultaClient
Task 3 → Rota /consulta/demo
Task 4 → DEX tour CTA
Task 5 → Step procedimentos no onboarding
Task 7 → Downgrade D14
```

## Verificação final

Após todas as tasks, testar o fluxo completo:

1. Novo usuário se cadastra → email D0 chega na caixa de entrada
2. Onboarding: plano → form → tela de procedimentos → sucesso
3. Dashboard: DEX tour step MODO_CONSULTA mostra CTA "→ Experimentar agora"
4. Clicar CTA → navega para `/consulta/demo`
5. No demo: botão "Iniciar atendimento" funciona sem API call
6. Falar ou digitar texto → "Organizar com DEX" chama IA real e estrutura ficha
7. Clicar "Salvar ficha" → modal de sucesso com CTA "Fazer minha primeira consulta real" (não persiste no banco)
8. Trial expirado: tentar acessar `/consulta/[id]` → redirect para dashboard com banner de upgrade
