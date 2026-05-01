-- Tabela de pagamentos a fornecedores
CREATE TABLE public.pagamentos_fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text NOT NULL,
  comprovante_url text,
  observacoes text,
  pago_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pag_forn_fornecedor ON public.pagamentos_fornecedor(fornecedor_id);
CREATE INDEX idx_pag_forn_data ON public.pagamentos_fornecedor(data_pagamento DESC);

ALTER TABLE public.pagamentos_fornecedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pag_forn admin all" ON public.pagamentos_fornecedor
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pag_forn fornecedor select" ON public.pagamentos_fornecedor
  FOR SELECT USING (
    public.has_role(auth.uid(), 'fornecedor') AND fornecedor_id = auth.uid()
  );

-- Tabela de junção: vincula pagamento a serviços (M2M)
CREATE TABLE public.pagamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id uuid NOT NULL REFERENCES public.pagamentos_fornecedor(id) ON DELETE CASCADE,
  tipo_servico text NOT NULL CHECK (tipo_servico IN ('manutencao','abastecimento','despesa')),
  servico_id uuid NOT NULL,
  valor_aplicado numeric(12,2) NOT NULL CHECK (valor_aplicado > 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_servico, servico_id, pagamento_id)
);

CREATE INDEX idx_pag_itens_pagamento ON public.pagamento_itens(pagamento_id);
CREATE INDEX idx_pag_itens_servico ON public.pagamento_itens(tipo_servico, servico_id);

ALTER TABLE public.pagamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pag_itens admin all" ON public.pagamento_itens
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pag_itens fornecedor select" ON public.pagamento_itens
  FOR SELECT USING (
    public.has_role(auth.uid(), 'fornecedor') AND EXISTS (
      SELECT 1 FROM public.pagamentos_fornecedor p
      WHERE p.id = pagamento_itens.pagamento_id AND p.fornecedor_id = auth.uid()
    )
  );

-- Bucket comprovantes já existe; adicionar policy específica para admin gerenciar pasta pagamentos/
CREATE POLICY "comprovantes admin pagamentos all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'comprovantes' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'comprovantes' AND public.has_role(auth.uid(), 'admin'));