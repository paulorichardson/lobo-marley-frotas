ALTER TABLE public.fornecedores_cadastro
  ADD COLUMN IF NOT EXISTS taxa_percentual numeric(5,2) NOT NULL DEFAULT 0
    CHECK (taxa_percentual >= 0 AND taxa_percentual <= 100);
COMMENT ON COLUMN public.fornecedores_cadastro.taxa_percentual IS 'Percentual de taxa/comissão que a Lobo Marley cobra deste fornecedor (descontado do valor a pagar).';