/**
 * Versão texto puro do e-mail de convite.
 * Enviar junto com o HTML melhora a entregabilidade — e-mails só-HTML são um
 * gatilho comum de filtros de spam.
 */
export function conviteEmailText({
  clinicaNome,
  link,
}: {
  clinicaNome: string;
  link: string;
}): string {
  return [
    `Você foi convidado para a equipe da clínica ${clinicaNome} no Odonto.IA.`,
    ``,
    `Acesse o link abaixo para aceitar o convite e configurar seu acesso.`,
    `Este link é válido por 7 dias.`,
    ``,
    link,
    ``,
    `Se você não esperava este convite, pode ignorar este e-mail com segurança.`,
    ``,
    `Equipe Odonto.IA`,
  ].join('\n');
}

export function conviteEmailHtml({
  clinicaNome,
  link,
}: {
  clinicaNome: string;
  link: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Convite — Odonto.IA</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#2f9c85;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Odonto.IA</p>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Sistema operacional inteligente para consultas</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0d0d0d;">Você foi convidado!</p>
              <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
                A clínica <strong style="color:#0d0d0d;">${clinicaNome}</strong> convidou você para fazer parte da equipe no Odonto.IA.
              </p>

              <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6;">
                Clique no botão abaixo para aceitar o convite e configurar seu acesso. Este link é válido por <strong style="color:#0d0d0d;">7 dias</strong>.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background-color:#2f9c85;border-radius:8px;">
                    <a href="${link}" target="_blank"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                      Aceitar convite
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 8px;font-size:12px;color:#888888;">
                Se o botão não funcionar, copie e cole este link no navegador:
              </p>
              <p style="margin:0;font-size:12px;word-break:break-all;">
                <a href="${link}" style="color:#2f9c85;text-decoration:underline;">${link}</a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #eeeeee;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0;font-size:13px;color:#aaaaaa;line-height:1.6;">
                Se você não esperava este convite, pode ignorar este e-mail com segurança. Nenhuma ação será tomada sem sua confirmação.
              </p>
              <p style="margin:16px 0 0;font-size:13px;color:#aaaaaa;">
                Equipe Odonto.IA
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
