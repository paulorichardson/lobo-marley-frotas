ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS setor TEXT;
CREATE INDEX IF NOT EXISTS idx_veiculos_empresa_setor ON public.veiculos(empresa_id, setor);