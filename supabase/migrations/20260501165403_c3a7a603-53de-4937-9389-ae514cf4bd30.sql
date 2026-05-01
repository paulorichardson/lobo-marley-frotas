-- Novos campos em manutencoes
ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS validade_orcamento date,
  ADD COLUMN IF NOT EXISTS valor_mao_obra numeric(12,2),
  ADD COLUMN IF NOT EXISTS desconto numeric(12,2),
  ADD COLUMN IF NOT EXISTS os_oficina text,
  ADD COLUMN IF NOT EXISTS diagnostico text,
  ADD COLUMN IF NOT EXISTS servico_executado text,
  ADD COLUMN IF NOT EXISTS aprovado_nome text;

-- Tabela de peças
CREATE TABLE IF NOT EXISTS public.manutencao_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manutencao_id uuid NOT NULL REFERENCES public.manutencoes(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade numeric(10,3) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  valor_unitario numeric(12,2) NOT NULL CHECK (valor_unitario >= 0),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manut_pecas_manut ON public.manutencao_pecas(manutencao_id);

ALTER TABLE public.manutencao_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pecas admin all" ON public.manutencao_pecas
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pecas via manutencao" ON public.manutencao_pecas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.manutencoes m
      WHERE m.id = manutencao_pecas.manutencao_id
        AND (
          (public.has_role(auth.uid(), 'gestor_frota') AND m.empresa_id = public.get_empresa_id())
          OR (public.has_role(auth.uid(), 'fornecedor') AND m.fornecedor_id = auth.uid())
          OR (m.solicitado_por = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.manutencoes m
      WHERE m.id = manutencao_pecas.manutencao_id
        AND (
          (public.has_role(auth.uid(), 'gestor_frota') AND m.empresa_id = public.get_empresa_id())
          OR (public.has_role(auth.uid(), 'fornecedor') AND m.fornecedor_id = auth.uid())
        )
    )
  );