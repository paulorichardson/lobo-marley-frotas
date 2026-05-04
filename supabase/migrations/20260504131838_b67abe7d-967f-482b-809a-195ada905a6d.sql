ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS valor_maximo_autorizado NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS prazo_esperado DATE,
  ADD COLUMN IF NOT EXISTS exigir_orcamento BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS avaliacao_estrelas INTEGER,
  ADD COLUMN IF NOT EXISTS avaliacao_comentario TEXT,
  ADD COLUMN IF NOT EXISTS enviado_para_rede BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_orcamentos_recebidos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS solicitacao_pai_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manutencoes_avaliacao_estrelas_check') THEN
    ALTER TABLE public.manutencoes
      ADD CONSTRAINT manutencoes_avaliacao_estrelas_check
      CHECK (avaliacao_estrelas IS NULL OR (avaliacao_estrelas BETWEEN 1 AND 5));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_manutencoes_solicitacao_pai ON public.manutencoes(solicitacao_pai_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_empresa_status ON public.manutencoes(empresa_id, status);