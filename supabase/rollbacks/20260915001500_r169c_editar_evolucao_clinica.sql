-- Retirar somente após retornar o app a uma versão que não chama esta RPC.
drop function if exists public.editar_evolucao_clinica(uuid, uuid, uuid, uuid, text, text);
