-- =============================================
-- CORRECAO 1: Funcao get_perfil() e tabela faturas
-- =============================================

-- Funcao get_perfil() que estava faltando
CREATE OR REPLACE FUNCTION public.get_perfil()
RETURNS TEXT AS $$
  SELECT role_name FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Tabela faturas que estava faltando
CREATE TABLE IF NOT EXISTS public.faturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id),
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    valor_abastecimentos NUMERIC(12,2) DEFAULT 0,
    valor_servicos NUMERIC(12,2) DEFAULT 0,
    valor_despesas NUMERIC(12,2) DEFAULT 0,
    taxa_gestao_percentual NUMERIC(5,2) DEFAULT 0,
    valor_taxa NUMERIC(12,2) DEFAULT 0,
    valor_total NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','emitida','paga','cancelada')),
    data_emissao TIMESTAMPTZ,
    data_pagamento TIMESTAMPTZ,
    observacoes TEXT,
    criado_por UUID REFERENCES public.perfis(id),
    criado_em TIMESTAMPTZ DEFAULT NOW()
  );

ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faturas_admin" ON public.faturas
  FOR ALL USING (public.get_perfil() = 'admin_saas');

CREATE POLICY "faturas_empresa" ON public.faturas
  FOR SELECT USING (empresa_id = public.get_empresa_id());
