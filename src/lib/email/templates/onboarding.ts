const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dentia.app.br';

const header = `
  <tr>
    <td style="background-color:#2f9c85;padding:32px 40px;text-align:center;">
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Odonto.IA</p>
      <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Sistema operacional inteligente para consultas</p>
    </td>
  </tr>`;

const footer = `
  <tr>
    <td style="padding:0 40px;">
      <hr style="border:none;border-top:1px solid #eeeeee;margin:0;" />
    </td>
  </tr>
  <tr>
    <td style="padding:24px 40px 32px;">
      <p style="margin:0;font-size:13px;color:#aaaaaa;line-height:1.6;">
        Você está recebendo este e-mail porque criou uma conta no Odonto.IA.
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#aaaaaa;">Equipe Odonto.IA</p>
    </td>
  </tr>`;

function wrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          ${header}
          ${content}
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
      <tr>
        <td style="background-color:#2f9c85;border-radius:8px;">
          <a href="${href}" target="_blank"
             style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

// ── D0 — Boas-vindas (imediato após cadastro) ─────────────────────────────────

export function onboardingD0Html({ nomeDentista }: { nomeDentista: string }): string {
  const link = `${BASE_URL}/consulta-demo`;
  return wrapper(`
    <tr>
      <td style="padding:40px 40px 32px;">
        <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0d0d0d;">Olá, ${nomeDentista}.</p>
        <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
          Já criamos um paciente de demonstração pra você. Entre e fale durante uma consulta — o DEX estrutura a ficha sozinho, sem você digitar uma palavra.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
          Isso leva menos de 2 minutos. Experimente agora.
        </p>
        ${ctaButton(link, '→ Fazer minha primeira consulta')}
      </td>
    </tr>`);
}

// ── D1A — Ativação confirmada (dentista fez a primeira consulta) ──────────────

export function onboardingD1AtivoHtml({ nomeDentista }: { nomeDentista: string }): string {
  const link = `${BASE_URL}/dashboard/pacientes/novo`;
  return wrapper(`
    <tr>
      <td style="padding:40px 40px 32px;">
        <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0d0d0d;">Boa, ${nomeDentista}.</p>
        <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
          Você viu o DEX em ação. Agora use com um paciente real na sua próxima consulta.
        </p>
        ${ctaButton(link, '→ Adicionar paciente')}
      </td>
    </tr>`);
}

// ── D1B — Não ativou ainda (dentista não fez nenhuma consulta) ────────────────

export function onboardingD1InativoHtml({ nomeDentista }: { nomeDentista: string }): string {
  const link = `${BASE_URL}/consulta-demo`;
  return wrapper(`
    <tr>
      <td style="padding:40px 40px 32px;">
        <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0d0d0d;">${nomeDentista}, isso leva 90 segundos.</p>
        <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
          Você não precisa de um paciente real. Já criamos um de demonstração — é só entrar e falar.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
          O DEX transcreve, organiza e preenche a ficha enquanto você atende. Veja acontecer.
        </p>
        ${ctaButton(link, '→ Testar agora')}
      </td>
    </tr>`);
}

// ── D3 — Prova de resultado ───────────────────────────────────────────────────

export function onboardingD3Html({ nomeDentista }: { nomeDentista: string }): string {
  const link = `${BASE_URL}/dashboard/agendamentos`;
  return wrapper(`
    <tr>
      <td style="padding:40px 40px 32px;">
        <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0d0d0d;">${nomeDentista}, quanto tempo você perde documentando consultas?</p>
        <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
          Cada ficha digitada manualmente leva tempo que poderia estar sendo usado no próximo paciente — ou no fim do seu dia.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
          Com o Modo Consulta, o DEX faz isso enquanto você fala. A ficha aparece pronta quando você termina de atender.
        </p>
        ${ctaButton(link, '→ Ver minha agenda desta semana')}
      </td>
    </tr>`);
}

// ── D7 — Conversão (7 dias antes do fim do trial) ────────────────────────────

export function onboardingD7Html({
  nomeDentista,
  fichasCriadas,
  dataExpiracao,
}: {
  nomeDentista: string;
  fichasCriadas: number;
  dataExpiracao: string;
}): string {
  const link = `${BASE_URL}/configuracoes/plano`;
  return wrapper(`
    <tr>
      <td style="padding:40px 40px 32px;">
        <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0d0d0d;">${nomeDentista}, você criou ${fichasCriadas} ficha${fichasCriadas !== 1 ? 's' : ''} com o DEX.</p>
        <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
          Essas fichas ficam com você — mas o acesso ao Modo Consulta encerra no dia <strong style="color:#0d0d0d;">${dataExpiracao}</strong>.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
          Continue usando sem interrupção com o Plano Solo.
        </p>
        ${ctaButton(link, '→ Continuar com o Plano Solo — R$249/mês')}
        <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;">
          PS: Precisa de mais tempo para avaliar? Responda este e-mail.
        </p>
      </td>
    </tr>`);
}
