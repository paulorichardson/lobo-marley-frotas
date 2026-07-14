
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS pneu_aro TEXT,
  ADD COLUMN IF NOT EXISTS pneu_medida_original TEXT,
  ADD COLUMN IF NOT EXISTS pneus_compativeis TEXT,
  ADD COLUMN IF NOT EXISTS pneu_indice_carga_vel TEXT,
  ADD COLUMN IF NOT EXISTS pneu_observacao TEXT,
  ADD COLUMN IF NOT EXISTS oleo_lubrificante TEXT;
