
-- ============================================================
-- Fornecedores externos (oficinas sem login no sistema) +
-- Faturamento por cliente + ampliação de pagamentos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fornecedores_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  email text,
  telefone text,
  responsavel text,
  banco text,
  agencia text,
  conta text,
  pix_chave text,
  pix_tipo text,
  endereco text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores_externos TO authenticated;
GRANT ALL ON public.fornecedores_externos TO service_role;
ALTER TABLE public.fornecedores_externos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forn_ext admin all" ON public.fornecedores_externos
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "forn_ext gestor select" ON public.fornecedores_externos
  FOR SELECT USING (has_role(auth.uid(),'gestor_frota'::app_role));

CREATE TRIGGER set_updated_at_forn_ext
  BEFORE UPDATE ON public.fornecedores_externos
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

-- ============================================================
-- manutencoes: vincular fornecedor externo (oficina sem login)
-- ============================================================
ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS fornecedor_externo_id uuid REFERENCES public.fornecedores_externos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fatura_id uuid;

CREATE INDEX IF NOT EXISTS idx_manut_fornecedor_externo
  ON public.manutencoes(fornecedor_externo_id);
CREATE INDEX IF NOT EXISTS idx_manut_fatura ON public.manutencoes(fatura_id);

-- ============================================================
-- faturas: número da NF e link com OSs
-- ============================================================
ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS numero_nf text,
  ADD COLUMN IF NOT EXISTS serie_nf text,
  ADD COLUMN IF NOT EXISTS manutencao_ids uuid[],
  ADD COLUMN IF NOT EXISTS numero_fatura text;

CREATE SEQUENCE IF NOT EXISTS public.fatura_numero_seq START 1;

CREATE OR REPLACE FUNCTION public.tg_atribui_numero_fatura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.numero_fatura IS NULL THEN
    NEW.numero_fatura := 'FAT-' || to_char(now(),'YYYY') || '-' ||
                         lpad(nextval('public.fatura_numero_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS atribui_numero_fatura ON public.faturas;
CREATE TRIGGER atribui_numero_fatura
  BEFORE INSERT ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.tg_atribui_numero_fatura();

-- ============================================================
-- pagamentos_fornecedor: suportar fornecedor externo + empresa
-- ============================================================
ALTER TABLE public.pagamentos_fornecedor
  ALTER COLUMN fornecedor_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS fornecedor_externo_id uuid REFERENCES public.fornecedores_externos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manutencao_id uuid REFERENCES public.manutencoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_documento text;

ALTER TABLE public.pagamentos_fornecedor
  DROP CONSTRAINT IF EXISTS pag_forn_um_destinatario;
ALTER TABLE public.pagamentos_fornecedor
  ADD CONSTRAINT pag_forn_um_destinatario
  CHECK (fornecedor_id IS NOT NULL OR fornecedor_externo_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pag_forn_ext ON public.pagamentos_fornecedor(fornecedor_externo_id);
CREATE INDEX IF NOT EXISTS idx_pag_forn_empresa ON public.pagamentos_fornecedor(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pag_forn_manut ON public.pagamentos_fornecedor(manutencao_id);

DROP POLICY IF EXISTS "pag_forn gestor empresa select" ON public.pagamentos_fornecedor;
CREATE POLICY "pag_forn gestor empresa select" ON public.pagamentos_fornecedor
  FOR SELECT USING (
    has_role(auth.uid(),'gestor_frota'::app_role)
    AND empresa_id = get_empresa_id()
  );
