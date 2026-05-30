/**
 * Extracts the storage object path from a stored value that may be either:
 *   - An old full public URL:  https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
 *   - A new storage path only: {clinicId}/{patientId}/filename.ext
 *
 * Used for backward compatibility with records written before migration 058
 * (when the fichas bucket was public and full URLs were stored).
 */
export function toStoragePath(urlOrPath: string, bucket: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
  if (urlOrPath.startsWith(publicPrefix)) {
    return urlOrPath.slice(publicPrefix.length);
  }
  return urlOrPath;
}
