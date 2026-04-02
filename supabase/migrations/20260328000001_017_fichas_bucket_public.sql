-- Migration 017: tornar bucket fichas público e expandir MIME types aceitos
--
-- Problema: bucket fichas estava como public=false, causando HTTP 403 ao tentar
-- exibir imagens via Next.js <Image> (getPublicUrl gera URL pública mas o bucket
-- bloqueava leituras sem autenticação). Thumbnails e lightbox não exibiam nada.
--
-- Solução: bucket público com URLs opacas (UUID de clinica_id/paciente_id no path)
-- é aceitável no MVP — o risco é baixo pois as URLs não são adivinháveis.

UPDATE storage.buckets
SET
  public = true,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
WHERE id = 'fichas';
