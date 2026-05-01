
ALTER TABLE public.abastecimentos
  ADD COLUMN IF NOT EXISTS via_qrcode boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_abast_via_qrcode ON public.abastecimentos(via_qrcode) WHERE via_qrcode = true;
