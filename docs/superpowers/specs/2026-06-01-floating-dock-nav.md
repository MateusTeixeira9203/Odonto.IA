# Spec — Floating Dock Navigation
**Data:** 2026-06-01  
**Status:** Aprovado  
**Substitui:** `SidebarContent` (sidebar vertical fixa à esquerda)

---

## Visão Geral

Substituir a sidebar lateral por um dock flutuante fixo no centro-inferior da tela. O dock concentra os 5 módulos principais + bell de notificações + avatar do usuário numa pill glassmorphism premium.

**Desktop/Tablet:** dock flutuante centralizado, `bottom-6`.  
**Mobile:** dock some; header fixo simples com logo + hamburger abre drawer lateral.

---

## Motivação

- Sidebar vertical consome espaço horizontal valioso no conteúdo clínico
- Bottom dock é padrão de UX moderno (Linear, Vercel, Notion)
- Dá sensação de produto premium e flutuante
- Targets maiores e mais acessíveis para uso com luvas ou pressa
- Libera 100% da largura para o workspace do paciente

---

## Arquitetura

### Componentes novos

```
src/components/layout/
  floating-dock.tsx         ← componente principal
  dock-nav-item.tsx         ← item individual de navegação
  mobile-header.tsx         ← header fixo para mobile
  mobile-drawer.tsx         ← drawer de navegação mobile
```

### Componentes removidos / deprecados
- `sidebar-content.tsx` — mantido no filesystem mas não mais usado no layout
- `clinic-switcher.tsx` — migrado para o dropdown do avatar no dock

### Layout shell
**Arquivo:** `src/app/dashboard/layout.tsx` (ou equivalente)

- Remover o `flex` com sidebar lateral
- Conteúdo ocupa `w-full` sem padding-left
- Adicionar `pb-28` no wrapper de conteúdo (espaço acima do dock)
- Renderizar `<FloatingDock />` e `<MobileHeader />` dentro do layout

---

## FloatingDock — Especificação Visual

### Container

```tsx
// Desktop: centralizado, flutuante
className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 hidden md:flex"

// Estilo do pill
style={{
  background: 'rgba(12, 17, 14, 0.88)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)',
  boxShadow: '0 8px 40px -8px rgba(47,156,133,0.22), 0 2px 12px -4px rgba(0,0,0,0.5)',
}}
className="rounded-2xl flex items-center gap-1 px-2 py-2"
```

### DockNavItem (os 5 itens de nav)

```tsx
// Estado inativo
<button className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl
  hover:bg-white/[0.05] transition-all duration-150 group min-w-[64px]">
  <Icon className="w-5 h-5 text-white/50 group-hover:text-white/80
    group-hover:-translate-y-0.5 transition-all duration-150" />
  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35
    group-hover:text-white/60 transition-colors">
    {label}
  </span>
</button>

// Estado ativo — pill teal por trás
<button className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl
  bg-teal/[0.12] relative min-w-[64px]">
  <Icon className="w-5 h-5 text-teal" />
  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-teal/80">
    {label}
  </span>
  {/* Dot ativo embaixo */}
  <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2
    w-1 h-1 rounded-full bg-teal" />
</button>
```

### Separador

```tsx
<div className="w-px h-6 bg-white/[0.07] mx-1 shrink-0" />
```

### NotificationBell

Reusar o componente `<NotificationBell />` existente, passando `isExpanded={false}` (modo ícone compacto). O badge de alerta permanece funcional.

### Avatar + Dropdown

```tsx
// Avatar trigger
<DropdownMenu.Trigger>
  <button className="relative ml-1 hover:scale-105 transition-transform">
    <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center
      text-white font-bold text-[11px] ring-2 ring-teal/20 overflow-hidden">
      {avatarUrl ? <Image ... /> : initials}
    </div>
    {/* Online dot */}
    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full
      bg-emerald-400 border-[1.5px] border-[#0c110e]" />
  </button>
</DropdownMenu.Trigger>

// Dropdown content (abre pra cima: side="top")
<DropdownMenu.Content side="top" sideOffset={12} align="end"
  style={{ background: 'rgba(12,17,14,0.97)', border: '1px solid rgba(47,156,133,0.12)' }}
  className="rounded-xl p-1.5 shadow-2xl min-w-[180px] z-[100]">

  {/* Cabeçalho do usuário */}
  <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
    <div className="text-[13px] font-semibold text-white/90">{nome}</div>
    <div className="text-[11px] text-white/35">{clinicaNome}</div>
  </div>

  {/* Clínica switcher compacto */}
  <ClinicSwitcher compact />

  <DropdownMenu.Separator className="h-px bg-white/[0.06] my-1" />

  {/* Toggle de tema */}
  <DropdownMenu.Item onSelect={toggleTheme}>
    {theme === 'dark' ? <Sun /> : <Moon />}
    {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
  </DropdownMenu.Item>

  {/* Perfil */}
  <DropdownMenu.Item onSelect={() => router.push('/dashboard/perfil')}>
    <User /> Meu Perfil
  </DropdownMenu.Item>

  <DropdownMenu.Separator />

  {/* Sair */}
  <DropdownMenu.Item onSelect={handleLogout} className="text-red-400">
    <LogOut /> Sair
  </DropdownMenu.Item>
</DropdownMenu.Content>
```

---

## Mobile — MobileHeader + MobileDrawer

### MobileHeader

```tsx
// Visível apenas em mobile (hidden md:hidden → block md:hidden)
<header className="fixed top-0 left-0 right-0 z-50 md:hidden
  bg-brand-charcoal/90 backdrop-blur-xl border-b border-white/[0.06]
  flex items-center justify-between px-4 h-14">
  <OdontoIALogo className="w-5 h-5 text-teal" />
  <span className="font-bold text-[15px] text-white">
    Odonto<span className="text-teal">.IA</span>
  </span>
  <button onClick={openDrawer}>
    <Menu className="w-5 h-5 text-white/70" />
  </button>
</header>
```

### MobileDrawer

Sheet lateral (esquerda → direita) com a lista de navegação completa. Reusar padrão visual dos itens da sidebar atual mas em formato sheet. Inclui: todos os nav items, tema, perfil, logout.

---

## Itens de Navegação

| Ícone | Label | Href | Visibilidade |
|-------|-------|------|-------------|
| `LayoutDashboard` | Início | `/dashboard` | sempre |
| `Users` | Pacientes | `/dashboard/pacientes` | sempre |
| `Calendar` | Agenda | `/dashboard/agendamentos` | sempre |
| `Wallet` | Financeiro | `/dashboard/financeiro` | bloqueado se sem plano |
| `Settings` | Config | `/dashboard/configuracoes` | só admin |

**Financeiro bloqueado:** ícone com `text-white/20`, sem hover, exibe `<Lock />` sobreposto em `w-3 h-3`.

**Config visível apenas pra admin:** se não admin, o item some do dock (Config vai pro dropdown do avatar como fallback).

---

## Animações

- **Entrada do dock:** `motion` com `initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}` na montagem
- **Hover do item:** `group-hover:-translate-y-0.5` no ícone
- **Active pill:** `layoutId="dock-active-pill"` para transição suave entre items ativos
- **Dropdown:** `animate-in fade-in zoom-in` padrão shadcn

---

## Layout Shell — Mudanças

### Antes
```tsx
<div className="flex h-screen">
  <SidebarContent ... />
  <main className="flex-1 overflow-auto">
    {children}
  </main>
</div>
```

### Depois
```tsx
<div className="min-h-screen">
  <MobileHeader ... />  {/* só mobile */}
  <main className="w-full pb-28 pt-0 md:pt-0">  {/* pb-28 = espaço do dock */}
    {children}
  </main>
  <FloatingDock ... />  {/* só desktop/tablet */}
  <MobileDrawer ... />  {/* só mobile */}
</div>
```

---

## Props do FloatingDock

```typescript
interface FloatingDockProps {
  nome: string;
  clinicaNome: string;
  activeClinicId: string;
  role: DentistaRole;
  avatarUrl?: string | null;
  plano?: PlanoId;
}
```

---

## Checklist de Qualidade

- [ ] Dock visível em desktop/tablet (`md:flex`, `hidden` em mobile)
- [ ] MobileHeader visível só em mobile (`block md:hidden`)
- [ ] 5 itens de nav com active state correto (layoutId animado)
- [ ] NotificationBell com badge funcional
- [ ] Avatar abre dropdown `side="top"` com nome + clínica + tema + perfil + sair
- [ ] Conteúdo não esconde atrás do dock (`pb-28`)
- [ ] Item bloqueado (Financeiro) com visual correto
- [ ] Config some do dock se não for admin
- [ ] Online dot `bg-emerald-400` (contraste sobre avatar teal)
- [ ] Dark mode sem regressão
- [ ] TypeScript sem erros
