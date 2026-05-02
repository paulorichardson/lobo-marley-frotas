-- Tabela faturas
CREATE TABLE IF NOT EXISTS public.faturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  valor_abastecimentos NUMERIC(12,2) DEFAULT 0,
  valor_servicos NUMERIC(12,2) DEFAULT 0,
  valor_despesas NUMERIC(12,2) DEFAULT 0,
  taxa_gestao_percentual NUMERIC(5,2) DEFAULT 0,
  valor_taxa NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','emitida','paga','cancelada')),
  data_emissao TIMESTAMPTZ,
  data_pagamento TIMESTAMPTZ,
  observacoes TEXT,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faturas admin all" ON public.faturas;
CREATE POLICY "faturas admin all" ON public.faturas
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "faturas empresa select" ON public.faturas;
CREATE POLICY "faturas empresa select" ON public.faturas
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'gestor_frota')
    AND empresa_id = public.get_empresa_id()
  );

CREATE INDEX IF NOT EXISTS idx_faturas_empresa ON public.faturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_faturas_status ON public.faturas(status);

-- Triggers updated_at
DROP TRIGGER IF EXISTS set_updated_at_veiculos ON public.veiculos;
CREATE TRIGGER set_updated_at_veiculos
  BEFORE UPDATE ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_manutencoes ON public.manutencoes;
CREATE TRIGGER set_updated_at_manutencoes
  BEFORE UPDATE ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_empresas ON public.empresas;
CREATE TRIGGER set_updated_at_empresas
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_perfis ON public.perfis;
CREATE TRIGGER set_updated_at_perfis
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_solicitacoes ON public.solicitacoes;
CREATE TRIGGER set_updated_at_solicitacoes
  BEFORE UPDATE ON public.solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_faturas ON public.faturas;
CREATE TRIGGER set_updated_at_faturas
  BEFORE UPDATE ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Nota: a tabela checklists não possui coluna atualizado_em (criado_em apenas).
-- Trigger não criado para checklists para não quebrar updates.