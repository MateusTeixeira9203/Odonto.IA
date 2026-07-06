-- Remove as policies amplas que davam acesso cross-clínica aos buckets clínicos
-- (fichas, radiografias, audios). Predicado era só `auth.uid() IS NOT NULL`, sem
-- checagem de clínica — qualquer dentista logado de qualquer clínica lia/escrevia/
-- apagava radiografia, consentimento assinado e áudio de TODAS as clínicas.
--
-- As policies por-clínica ("dentistas podem ...", "fichas_objects_*") permanecem
-- e passam a ser o único controle → silo por clínica no storage.
--
-- spec-seguranca-silo-validacao.md, Frente 1 (achado A).
drop policy if exists "Dentistas acessam fichas"       on storage.objects;
drop policy if exists "Dentistas acessam radiografias" on storage.objects;
drop policy if exists "Dentistas acessam seus audios"  on storage.objects;
