import type { DadosColeta, WabaIncomingMessage } from '../types';
import { sendText } from '../client';
import { createServiceClient } from '@/lib/supabase/service';

interface CadastroContext {
  conversa: { id: string; paciente_id: string | null };
  ctx: { from: string; message: WabaIncomingMessage; phoneNumberId: string };
  clinicaId: string;
  accessToken: string;
  dadosColeta: DadosColeta;
  supabase: ReturnType<typeof createServiceClient>;
  config: unknown;
}

export async function handleCadastroFlow(c: CadastroContext) {
  const { conversa, ctx, clinicaId, accessToken, dadosColeta, supabase } = c;
  const texto = extractInput(ctx.message);

  // Seleção de dentista (resposta de botão)
  if (!dadosColeta.dentista_id && ctx.message.type === 'interactive') {
    const payload = ctx.message.interactive?.button_reply?.id ?? '';
    if (payload.startsWith('dentista_')) {
      const dentistaId = payload.replace('dentista_', '');
      // Valida que o dentista pertence a esta clínica — evita cross-tenant assignment
      const { data: d } = await supabase
        .from('dentistas')
        .select('nome')
        .eq('id', dentistaId)
        .eq('clinica_id', clinicaId)
        .eq('ativo', true)
        .maybeSingle();
      if (!d) {
        await sendText(ctx.from, 'Dentista inválido. Por favor, escolha uma das opções listadas.', ctx.phoneNumberId, accessToken);
        return;
      }
      const novosDados: DadosColeta = { ...dadosColeta, dentista_id: dentistaId, dentista_nome: d.nome as string | undefined, etapa_cadastro: 'nome' };
      await supabase.from('conversas_bot').update({ dados_coleta: novosDados, dentista_id: dentistaId }).eq('id', conversa.id);
      await sendText(ctx.from, `Ótimo! Dr(a). ${d.nome ?? ''}. Qual é o seu nome completo?`, ctx.phoneNumberId, accessToken);
      return;
    }
  }

  const etapa = dadosColeta.etapa_cadastro;

  if (!dadosColeta.dentista_id || !etapa) {
    await sendText(ctx.from, 'Por favor, escolha um dentista digitando *oi* para recomeçar.', ctx.phoneNumberId, accessToken);
    return;
  }

  if (etapa === 'nome') {
    if (!texto || texto.length < 3) {
      await sendText(ctx.from, 'Por favor, informe seu nome completo.', ctx.phoneNumberId, accessToken);
      return;
    }
    // Pula coleta de telefone — usa ctx.from (E.164 verificado pelo WhatsApp) diretamente
    const novosDados: DadosColeta = {
      ...dadosColeta,
      nome:             texto,
      telefone:         ctx.from,
      etapa_cadastro:   'nascimento',
    };
    await supabase.from('conversas_bot').update({ dados_coleta: novosDados }).eq('id', conversa.id);
    await sendText(ctx.from, 'Obrigado! Qual a sua data de nascimento? (DD/MM/AAAA)', ctx.phoneNumberId, accessToken);
    return;
  }

  if (etapa === 'nascimento') {
    const nascParsed = parseDateBR(texto);
    if (!nascParsed) {
      await sendText(ctx.from, 'Data inválida. Use o formato DD/MM/AAAA. Ex: 15/03/1990', ctx.phoneNumberId, accessToken);
      return;
    }
    const { data: paciente, error } = await supabase.from('pacientes').insert({
      clinica_id:      clinicaId,
      dentista_id:     dadosColeta.dentista_id,
      nome:            dadosColeta.nome!,
      telefone:        ctx.from,
      whatsapp:        ctx.from,
      data_nascimento: nascParsed,
    }).select('id').single();

    if (error || !paciente) {
      await sendText(ctx.from, 'Ocorreu um erro ao salvar seu cadastro. Tente novamente ou ligue para a clínica.', ctx.phoneNumberId, accessToken);
      return;
    }

    await supabase.from('conversas_bot').update({
      paciente_id:  paciente.id,
      estado:       'agendamento',
      dados_coleta: {},
    }).eq('id', conversa.id);

    await sendText(
      ctx.from,
      `✅ Cadastro realizado! Bem-vindo(a), ${dadosColeta.nome}!\n\nDeseja agendar uma consulta? Responda *sim* para continuar.`,
      ctx.phoneNumberId,
      accessToken,
    );
    return;
  }
}

function extractInput(msg: WabaIncomingMessage): string {
  if (msg.type === 'text') return (msg.text?.body ?? '').trim();
  if (msg.type === 'button') return (msg.button?.text ?? '').trim();
  return '';
}

function parseDateBR(input: string): string | null {
  const match = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(date.getTime())) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
