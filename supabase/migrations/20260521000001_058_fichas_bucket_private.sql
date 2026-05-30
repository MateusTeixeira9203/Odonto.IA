-- Migration 058: Make fichas bucket private + storage object policies
--
-- Security fix: bucket fichas was set to public=true in migration 017 as a workaround
-- for HTTP 403 errors when displaying images via getPublicUrl. The workaround relied on
-- URL obscurity (UUID-based paths) which is not acceptable for healthcare data (LGPD).
--
-- Correct solution:
--   1. Private bucket (public = false)
--   2. Storage object policies restricting access to authenticated clinic members
--   3. All display code uses createSignedUrl (time-limited) instead of getPublicUrl
--
-- Path convention enforced by policies: {clinicId}/... (clinicId is the first path segment)

-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'fichas';

-- Drop any existing storage policies for fichas to avoid conflicts
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname LIKE 'fichas_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Allow clinic members to upload files to their clinic's folder
CREATE POLICY "fichas_objects_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fichas'
  AND split_part(name, '/', 1) = public.get_my_clinica_id()::text
);

-- Allow clinic members to read files (required for createSignedUrl to succeed)
CREATE POLICY "fichas_objects_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'fichas'
  AND split_part(name, '/', 1) = public.get_my_clinica_id()::text
);

-- Allow clinic members to update/upsert files (e.g., signature overwrite)
CREATE POLICY "fichas_objects_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'fichas'
  AND split_part(name, '/', 1) = public.get_my_clinica_id()::text
)
WITH CHECK (
  bucket_id = 'fichas'
  AND split_part(name, '/', 1) = public.get_my_clinica_id()::text
);

-- Allow any clinic member to delete (matches existing delete UI)
CREATE POLICY "fichas_objects_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'fichas'
  AND split_part(name, '/', 1) = public.get_my_clinica_id()::text
);
