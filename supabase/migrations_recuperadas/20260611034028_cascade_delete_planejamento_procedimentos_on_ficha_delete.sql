
-- Função: limpa planejamento_procedimentos quando uma ficha é deletada
CREATE OR REPLACE FUNCTION fn_clean_procs_on_ficha_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM planejamento_procedimentos
  WHERE split_part(ficha_ref, '::', 1) = OLD.id::text;
  RETURN OLD;
END;
$$;

-- Trigger: executa a função após cada DELETE em fichas
DROP TRIGGER IF EXISTS trg_clean_procs_on_ficha_delete ON fichas;
CREATE TRIGGER trg_clean_procs_on_ficha_delete
  AFTER DELETE ON fichas
  FOR EACH ROW
  EXECUTE FUNCTION fn_clean_procs_on_ficha_delete();
