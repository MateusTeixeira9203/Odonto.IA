#Requires -Version 5.1
<#
.SYNOPSIS
    Setup inicial do Odonto.IA
.DESCRIPTION
    1. Verifica prerequisitos (Node.js 18+, npm)
    2. Instala dependencias npm
    3. Cria .env.local com todas as variaveis necessarias
    4. Exibe proximos passos
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step { param($msg) Write-Host "`n  $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [ERRO] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  Odonto.IA - Setup" -ForegroundColor White
Write-Host "  ----------------------------------------" -ForegroundColor DarkGray

Write-Step "Verificando prerequisitos..."

try {
    $nodeVersion = & node --version 2>$null
    if (-not $nodeVersion) { throw "nao encontrado" }
    $major = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($major -lt 18) {
        Write-Fail "Node.js $nodeVersion encontrado, mas e necessario >= 18. Baixe em https://nodejs.org"
    }
    Write-Ok "Node.js $nodeVersion"
} catch {
    Write-Fail "Node.js nao encontrado. Instale em https://nodejs.org"
}

try {
    $npmVersion = & npm --version 2>$null
    if (-not $npmVersion) { throw }
    Write-Ok "npm $npmVersion"
} catch {
    Write-Fail "npm nao encontrado. Reinstale o Node.js."
}

try {
    $sbVersion = & supabase --version 2>$null
    if ($sbVersion) {
        Write-Ok "Supabase CLI $sbVersion"
    } else { throw }
} catch {
    Write-Warn "Supabase CLI nao encontrado (opcional para dev local)."
    Write-Warn "  Instale com: winget install Supabase.CLI"
}

Write-Step "Instalando dependencias npm..."
& npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "Falha ao instalar dependencias." }
Write-Ok "Dependencias instaladas"

Write-Step "Configurando variaveis de ambiente..."

$envPath = Join-Path $PSScriptRoot ".env.local"

if (Test-Path $envPath) {
    Write-Ok ".env.local ja existe - nao foi sobrescrito"
} else {
    $lines = @(
        "# =========================================================="
        "# Odonto.IA -- Variaveis de Ambiente"
        "# Preencha os valores antes de rodar: npm run dev"
        "# =========================================================="
        ""
        "# ----------------------------------------------------------"
        "# SUPABASE (obrigatorio)"
        "# https://app.supabase.com -> Project Settings -> API"
        "# ----------------------------------------------------------"
        "NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY="
        "SUPABASE_SERVICE_ROLE_KEY="
        ""
        "# ----------------------------------------------------------"
        "# APP URL  (em dev: http://localhost:3000)"
        "# ----------------------------------------------------------"
        "NEXT_PUBLIC_APP_URL=http://localhost:3000"
        "NEXT_PUBLIC_SITE_URL=http://localhost:3000"
        ""
        "# ----------------------------------------------------------"
        "# IA (obrigatorio para funcionalidades core)"
        "# Gemini:  https://aistudio.google.com/app/apikey"
        "# Groq:    https://console.groq.com/keys"
        "# OpenAI:  https://platform.openai.com/api-keys"
        "# ----------------------------------------------------------"
        "GEMINI_API_KEY="
        "GROQ_API_KEY="
        "OPENAI_API_KEY="
        ""
        "# ----------------------------------------------------------"
        "# EMAIL (Resend)  https://resend.com/api-keys"
        "# ----------------------------------------------------------"
        "RESEND_API_KEY="
        ""
        "# ----------------------------------------------------------"
        "# CACHE / RATE LIMIT (Upstash Redis -- opcional em dev)"
        "# https://console.upstash.com"
        "# ----------------------------------------------------------"
        "UPSTASH_REDIS_REST_URL="
        "UPSTASH_REDIS_REST_TOKEN="
        ""
        "# ----------------------------------------------------------"
        "# PAGAMENTOS (AbacatePay)  https://app.abacatepay.com"
        "# ----------------------------------------------------------"
        "ABACATE_PAY_API_KEY="
        "ABACATE_PAY_WEBHOOK_SECRET="
        "ABACATE_PAY_PRODUCT_SOLO="
        "ABACATE_PAY_PRODUCT_CLINICA="
        "ABACATE_PAY_PRODUCT_AGREGADO="
        ""
        "# ----------------------------------------------------------"
        "# WHATSAPP META (opcional -- modulo WhatsApp)"
        "# https://developers.facebook.com/apps"
        "# ----------------------------------------------------------"
        "WHATSAPP_PHONE_NUMBER_ID="
        "WHATSAPP_ACCESS_TOKEN="
        "WHATSAPP_APP_SECRET="
        "WHATSAPP_VERIFY_TOKEN="
        "WHATSAPP_DEFAULT_CLINICA_ID="
        ""
        "# ----------------------------------------------------------"
        "# GOOGLE CALENDAR (opcional -- modulo Agenda)"
        "# https://console.cloud.google.com/apis/credentials"
        "# ----------------------------------------------------------"
        "GOOGLE_CLIENT_ID="
        "GOOGLE_CLIENT_SECRET="
        "GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/auth/callback"
        ""
        "# ----------------------------------------------------------"
        "# CRON SECRET (seguranca para endpoints de cron)"
        "# Gere com: node -e `"console.log(require('crypto').randomBytes(32).toString('hex'))`""
        "# ----------------------------------------------------------"
        "CRON_SECRET="
        ""
        "# ----------------------------------------------------------"
        "# ANALYTICS (PostHog -- opcional em dev)"
        "# https://app.posthog.com"
        "# ----------------------------------------------------------"
        "NEXT_PUBLIC_POSTHOG_KEY="
        "NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com"
    )
    $lines | Out-File -FilePath $envPath -Encoding utf8
    Write-Ok ".env.local criado - preencha as chaves antes de rodar o projeto"
}

Write-Host ""
Write-Host "  ----------------------------------------" -ForegroundColor DarkGray
Write-Host "  Setup concluido!" -ForegroundColor Green
Write-Host ""
Write-Host "  Proximos passos:" -ForegroundColor White
Write-Host "   1. Preencha as variaveis em .env.local" -ForegroundColor Gray
Write-Host "   2. Configure o Supabase e rode as migrations:" -ForegroundColor Gray
Write-Host "      supabase db push" -ForegroundColor DarkGray
Write-Host "   3. Inicie o servidor de desenvolvimento:" -ForegroundColor Gray
Write-Host "      npm run dev" -ForegroundColor DarkGray
Write-Host ""
