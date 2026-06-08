import { sendText, downloadMediaUrl } from '../client';
import { createServiceClient } from '@/lib/supabase/service';
import type { WabaIncomingMessage } from '../types';

interface PagamentoContext {
  conversa: { id: string; paciente_id: string | null };
  ctx: { from: string; message: WabaIncomingMessage; phoneNumberId: string };
  clinicaId: string;
  accessToken: string;
  supabase: ReturnType<typeof createServiceClient>;
  config: { access_token: string; phone_number_id: string };
}

export async function handlePagamentoFlow(c: PagamentoContext) {
  const { conversa, ctx, clinicaId, accessToken, supabase } = c;

  if (ctx.message.type === 'image' && ctx.message.image) {
    const mediaId = ctx.message.image.id;
    const { url } = await downloadMediaUrl(mediaId, c.config.access_token);

    if (!url) {
      await sendText(ctx.from, 'Não consegui processar a imagem. Tente enviar novamente.', ctx.phoneNumberId, accessToken);
      return;
    }

    await notificarSecretariaComprovante(supabase, clinicaId, {
      conversaId:  conversa.id,
      pacienteId:  conversa.paciente_id,
      mediaUrl:    url,
      telefone:    ctx.from,
    });

    await supabase.from('mensagens_bot').update({ media_url: url, media_type: 'image' })
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: false })
      .limit(1);

    await sendText(
      ctx.from,
      '✅ Comprovante recebido! Nossa equipe irá verificar e confirmar seu pagamento em breve.',
      ctx.phoneNumberId,
      accessToken,
    );
    return;
  }

  await sendText(
    ctx.from,
    'Para registrar seu pagamento, envie uma foto do comprovante.',
    ctx.phoneNumberId,
    accessToken,
  );
}

async function notificarSecretariaComprovante(
  supabase: ReturnType<typeof createServiceClient>,
  clinicaId: string,
  dados: { conversaId: string; pacienteId: string | null; mediaUrl: string; telefone: string },
) {
  await supabase.from('notificacoes').insert({
    clinica_id: clinicaId,
    para_role:  'secretaria',
    tipo:       'comprovante_recebido',
    titulo:     'Comprovante de pagamento recebido',
    mensagem:   `Comprovante recebido pelo WhatsApp do número ${dados.telefone}. Revisar e confirmar.`,
    dados:      {
      conversa_id: dados.conversaId,
      paciente_id: dados.pacienteId,
      media_url:   dados.mediaUrl,
    },
  });
}
