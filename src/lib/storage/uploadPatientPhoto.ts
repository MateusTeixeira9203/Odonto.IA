import { createClient } from '@/lib/supabase/client';

interface UploadResult {
  url: string;
  path: string;
  error?: string;
}

// Faz upload de foto do paciente para o Supabase Storage
export async function uploadPatientPhoto(
  file: File,
  pacienteId: string,
  clinicaId: string
): Promise<UploadResult> {
  const supabase = createClient();

  // Validar tipo de arquivo
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { url: '', path: '', error: 'Tipo de arquivo não permitido. Use JPG, PNG ou WebP.' };
  }

  // Validar tamanho (máx 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { url: '', path: '', error: 'Arquivo muito grande. Máximo 10MB.' };
  }

  const ext = file.name.split('.').pop();
  const fileName = `${clinicaId}/${pacienteId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('fichas')
    .upload(fileName, file, { upsert: false });

  if (error) return { url: '', path: '', error: error.message };

  const { data: urlData } = supabase.storage
    .from('fichas')
    .getPublicUrl(data.path);

  return { url: urlData.publicUrl, path: data.path };
}
