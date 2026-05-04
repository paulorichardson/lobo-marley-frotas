ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS tipo_bem TEXT NOT NULL DEFAULT 'veiculo',
  ADD COLUMN IF NOT EXISTS horimetro NUMERIC,
  ADD COLUMN IF NOT EXISTS numero_patrimonio TEXT,
  ADD COLUMN IF NOT EXISTS numero_serie TEXT;

CREATE INDEX IF NOT EXISTS idx_veiculos_tipo_bem ON public.veiculos(empresa_id, tipo_bem);