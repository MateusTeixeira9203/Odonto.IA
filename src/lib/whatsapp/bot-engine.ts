import { createServiceClient } from '@/lib/supabase/service';
import { sendText, sendButtons } from './client';
import { handleCadastroFlow } from './flows/cadastro';
import { handleAgendamentoFlow } from './flows/agendamento';
import { handlePagamentoFlow } from './flows/pagamento';
import type { WabaIncomingMessage, BotEstado, DadosColeta } from './types';

interface IncomingContext {
  phoneNumberId: string;
  from: string;
  fromName: string;
  message: WabaIncomingMessage;
}

export async function handleIncomingMessage(ctx: IncomingContext): Promise<void> {
  const supabase = createServiceClient();

  const { data: config } = await supabase
    .from('bot_config')
    .select('id, clinica_id, bot_ativo, access_token, phone_number_id, dentistas_ativos_bot, mensagem_boas_vindas')
    .eq('phone_number_id', ctx.phoneNumberId)
    .maybeSingle();

  if (!config || !config.bot_ativo) return;

  const clinicaId   = config.clinica_id as string;
  const accessToken = config.access_token as string;

  // Busca a conversa mais recente não-encerrada (usa limit(1) para tolerar duplicatas)
  const { data: conversas } = await supabase
    .from('conversas_bot')
    .select('id, estado, paciente_id, dentista_id, dados_coleta')
    .eq('clinica_id', clinicaId)
    .eq('telefone', ctx.from)
    .not('estado', 'in', '("encerrado")')
    .order('created_at', { ascending: false })
    .limit(1);

  let conversa = conversas?.[0] ?? null;

  // Se a conversa mais recente está em modo humano, o bot não interfere
  if (conversa?.estado === 'humano') return;

  if (!conversa) {
    const { data: nova } = await supabase
      .from('conversas_bot')
      .insert({
        clinica_id:   clinicaId,
        telefone:     ctx.from,
        nome:         ctx.fromName,
        canal:        'whatsapp',
        estado:       'inicio',
        dados_coleta: {},
      })
      .select('id, estado, paciente_id, dentista_id, dados_coleta')
      .single();
    conversa = nova;
  }

  if (!conversa) return;

  await supabase.from('mensagens_bot').insert({
    conversa_id: conversa.id,
    clinica_id:  clinicaId,
    direcao:     'entrada',
    conteudo:    extractText(ctx.message),
    media_url:   null,
    media_type:  ctx.message.type !== 'text' ? ctx.message.type : null,
  });

  const estado      = (conversa.estado ?? 'inicio') as BotEstado;
  const dadosColeta = (conversa.dados_coleta ?? {}) as DadosColeta;

  switch (estado) {
    case 'inicio':
      await handleInicio({ conversa, config, ctx, clinicaId, accessToken, supabase });
      break;
    case 'cadastro':
      await handleCadastroFlow({ conversa, ctx, clinicaId, accessToken, dadosColeta, supabase, config });
      break;
    case 'agendamento':
      await handleAgendamentoFlow({ conversa, ctx, clinicaId, accessToken, dadosColeta, supabase, config });
      break;
    case 'pagamento':
      await handlePagamentoFlow({ conversa, ctx, clinicaId, accessToken, supabase, config: config as { access_token: string; phone_number_id: string } });
      break;
    default:
      await sendText(ctx.from, 'Como posso ajudar? Digite *oi* para começar.', ctx.phoneNumberId, accessToken);
  }
}

async function handleInicio({ conversa, config, ctx, clinicaId, accessToken, supabase }: {
  conversa: { id: string };
  config: { dentistas_ativos_bot: string[] | null; mensagem_boas_vindas?: string | null };
  ctx: IncomingContext;
  clinicaId: string;
  accessToken: string;
  supabase: ReturnType<typeof createServiceClient>;
}) {
  const dentistasIds = (config.dentistas_ativos_bot ?? []) as string[];
  const { data: dentistas } = await supabase
    .from('dentistas')
    .select('id, nome')
    .in('id', dentistasIds)
    .eq('ativo', true);

  const boasVindas = (config.mensagem_boas_vindas as string | null | undefined)
    ?? 'Olá! Bem-vindo à nossa clínica. Qual dentista você prefere?';

  if (!dentistas || dentistas.length === 0) {
    await sendText(ctx.from, boasVindas + '\n\nEntre em contato pelo telefone da clínica.', ctx.phoneNumberId, accessToken);
    return;
  }

  await sendButtons(
    ctx.from,
    boasVindas,
    (dentistas as { id: string; nome: string }[]).map((d) => ({
      id:    `dentista_${d.id}`,
      title: d.nome.split(' ')[0],
    })),
    ctx.phoneNumberId,
    accessToken,
  );

  await supabase.from('conversas_bot').update({ estado: 'cadastro' }).eq('id', conversa.id);
}

function extractText(msg: WabaIncomingMessage): string {
  if (msg.type === 'text') return msg.text?.body ?? '';
  if (msg.type === 'interactive') {
    return msg.interactive?.button_reply?.title
      ?? msg.interactive?.list_reply?.title
      ?? '';
  }
  if (msg.type === 'button') return msg.button?.text ?? '';
  return `[${msg.type}]`;
}
