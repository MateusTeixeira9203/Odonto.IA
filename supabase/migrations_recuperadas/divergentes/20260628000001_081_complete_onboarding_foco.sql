DROP FUNCTION IF EXISTS public.complete_onboarding(text,text,text,text,text,text,text,text,text);
;
CREATE OR REPLACE FUNCTION public.complete_onboarding(... , p_foco_principal text DEFAULT NULL) ... grava foco_principal no INSERT do dentista;
;
REVOKE/GRANT EXECUTE na assinatura de 10 args;