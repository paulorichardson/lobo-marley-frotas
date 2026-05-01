-- 1. EMPRESAS
CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  site TEXT,
  logo_url TEXT,
  cep TEXT, logradouro TEXT, numero TEXT, complemento TEXT,
  bairro TEXT, cidade TEXT, estado TEXT,
  plano TEXT NOT NULL DEFAULT 'basico',
  limite_veiculos INTEGER,
  status TEXT NOT NULL DEFAULT 'ativo',
  data_inicio DATE, data_vencimento DATE,
  valor_mensal NUMERIC(10,2),
  observacoes TEXT,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_empresas_updated ON public.empresas;
CREATE TRIGGER trg_empresas_updated BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- 2. ADICIONA empresa_id
ALTER TABLE public.perfis         ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.veiculos       ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.checklists     ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.manutencoes    ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.despesas       ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.solicitacoes   ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.viagens        ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.veiculo_fotos  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_perfis_empresa     ON public.perfis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_empresa   ON public.veiculos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_checklists_empresa ON public.checklists(empresa_id);
CREATE INDEX IF NOT EXISTS idx_abast_empresa      ON public.abastecimentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_manut_empresa      ON public.manutencoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_despesas_empresa   ON public.despesas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_solic_empresa      ON public.solicitacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_viagens_empresa    ON public.viagens(empresa_id);
CREATE INDEX IF NOT EXISTS idx_veic_fotos_empresa ON public.veiculo_fotos(empresa_id);

-- 3. EMPRESA DEFAULT + MIGRAÇÃO (executa via EXECUTE para forçar nova fase de planejamento)
INSERT INTO public.empresas (razao_social, nome_fantasia, plano, status)
SELECT 'Lobo Marley (default)', 'Lobo Marley', 'enterprise', 'ativo'
WHERE NOT EXISTS (SELECT 1 FROM public.empresas WHERE razao_social = 'Lobo Marley (default)');

DO $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.empresas WHERE razao_social = 'Lobo Marley (default)' LIMIT 1;

  EXECUTE 'UPDATE public.perfis SET empresa_id = $1
           WHERE empresa_id IS NULL
             AND NOT public.has_role(id, ''admin''::app_role)
             AND NOT public.has_role(id, ''fornecedor''::app_role)' USING v_id;

  EXECUTE 'UPDATE public.veiculos       SET empresa_id = $1 WHERE empresa_id IS NULL' USING v_id;
  EXECUTE 'UPDATE public.checklists     SET empresa_id = $1 WHERE empresa_id IS NULL' USING v_id;
  EXECUTE 'UPDATE public.abastecimentos SET empresa_id = $1 WHERE empresa_id IS NULL' USING v_id;
  EXECUTE 'UPDATE public.manutencoes    SET empresa_id = $1 WHERE empresa_id IS NULL' USING v_id;
  EXECUTE 'UPDATE public.despesas       SET empresa_id = $1 WHERE empresa_id IS NULL' USING v_id;
  EXECUTE 'UPDATE public.solicitacoes   SET empresa_id = $1 WHERE empresa_id IS NULL' USING v_id;
  EXECUTE 'UPDATE public.viagens        SET empresa_id = $1 WHERE empresa_id IS NULL' USING v_id;
  EXECUTE 'UPDATE public.veiculo_fotos  SET empresa_id = $1 WHERE empresa_id IS NULL' USING v_id;
END $$;

-- 4. FUNÇÃO HELPER
CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
$$;

-- 5. RLS EMPRESAS
DROP POLICY IF EXISTS "empresas admin all"   ON public.empresas;
DROP POLICY IF EXISTS "empresas self select" ON public.empresas;

CREATE POLICY "empresas admin all" ON public.empresas
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "empresas self select" ON public.empresas
  FOR SELECT USING (id = public.get_empresa_id());

-- 6. RLS MULTI-TENANT
-- VEICULOS
DROP POLICY IF EXISTS "veiculos admin gestor all"  ON public.veiculos;
DROP POLICY IF EXISTS "veiculos fornecedor select" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos motorista select"  ON public.veiculos;

CREATE POLICY "veiculos admin all" ON public.veiculos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "veiculos gestor empresa" ON public.veiculos
  FOR ALL USING (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id())
  WITH CHECK (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id());
CREATE POLICY "veiculos motorista select" ON public.veiculos
  FOR SELECT USING (public.has_role(auth.uid(), 'motorista') AND motorista_id = auth.uid() AND empresa_id = public.get_empresa_id());
CREATE POLICY "veiculos fornecedor select" ON public.veiculos
  FOR SELECT USING (public.has_role(auth.uid(), 'fornecedor'));

-- CHECKLISTS
DROP POLICY IF EXISTS "check admin gestor all" ON public.checklists;
DROP POLICY IF EXISTS "check motorista all"    ON public.checklists;

CREATE POLICY "check admin all" ON public.checklists
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "check gestor empresa" ON public.checklists
  FOR ALL USING (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id())
  WITH CHECK (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id());
CREATE POLICY "check motorista own" ON public.checklists
  FOR ALL USING (motorista_id = auth.uid())
  WITH CHECK (motorista_id = auth.uid() AND empresa_id = public.get_empresa_id());

-- ABASTECIMENTOS
DROP POLICY IF EXISTS "abast admin gestor all"  ON public.abastecimentos;
DROP POLICY IF EXISTS "abast fornecedor insert" ON public.abastecimentos;
DROP POLICY IF EXISTS "abast fornecedor select" ON public.abastecimentos;
DROP POLICY IF EXISTS "abast motorista insert"  ON public.abastecimentos;
DROP POLICY IF EXISTS "abast motorista select"  ON public.abastecimentos;

CREATE POLICY "abast admin all" ON public.abastecimentos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "abast gestor empresa" ON public.abastecimentos
  FOR ALL USING (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id())
  WITH CHECK (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id());
CREATE POLICY "abast motorista select" ON public.abastecimentos
  FOR SELECT USING (motorista_id = auth.uid());
CREATE POLICY "abast motorista insert" ON public.abastecimentos
  FOR INSERT WITH CHECK (motorista_id = auth.uid() AND empresa_id = public.get_empresa_id());
CREATE POLICY "abast fornecedor select" ON public.abastecimentos
  FOR SELECT USING (public.has_role(auth.uid(), 'fornecedor') AND fornecedor_id = auth.uid());
CREATE POLICY "abast fornecedor insert" ON public.abastecimentos
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'fornecedor') AND fornecedor_id = auth.uid());

-- MANUTENCOES
DROP POLICY IF EXISTS "manut admin gestor all" ON public.manutencoes;
DROP POLICY IF EXISTS "manut fornecedor own"   ON public.manutencoes;
DROP POLICY IF EXISTS "manut motorista select" ON public.manutencoes;

CREATE POLICY "manut admin all" ON public.manutencoes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "manut gestor empresa" ON public.manutencoes
  FOR ALL USING (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id())
  WITH CHECK (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id());
CREATE POLICY "manut fornecedor own" ON public.manutencoes
  FOR ALL USING (public.has_role(auth.uid(), 'fornecedor') AND fornecedor_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'fornecedor') AND fornecedor_id = auth.uid());
CREATE POLICY "manut motorista select" ON public.manutencoes
  FOR SELECT USING (solicitado_por = auth.uid());

-- DESPESAS
DROP POLICY IF EXISTS "desp admin gestor all"  ON public.despesas;
DROP POLICY IF EXISTS "desp fornecedor insert" ON public.despesas;
DROP POLICY IF EXISTS "desp fornecedor select" ON public.despesas;

CREATE POLICY "desp admin all" ON public.despesas
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "desp gestor empresa" ON public.despesas
  FOR ALL USING (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id())
  WITH CHECK (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id());
CREATE POLICY "desp fornecedor select" ON public.despesas
  FOR SELECT USING (public.has_role(auth.uid(), 'fornecedor') AND lancado_por = auth.uid());
CREATE POLICY "desp fornecedor insert" ON public.despesas
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'fornecedor') AND lancado_por = auth.uid());

-- SOLICITACOES
DROP POLICY IF EXISTS "solic admin gestor all"  ON public.solicitacoes;
DROP POLICY IF EXISTS "solic fornecedor select" ON public.solicitacoes;
DROP POLICY IF EXISTS "solic motorista all"     ON public.solicitacoes;

CREATE POLICY "solic admin all" ON public.solicitacoes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "solic gestor empresa" ON public.solicitacoes
  FOR ALL USING (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id())
  WITH CHECK (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id());
CREATE POLICY "solic motorista own" ON public.solicitacoes
  FOR ALL USING (motorista_id = auth.uid())
  WITH CHECK (motorista_id = auth.uid() AND empresa_id = public.get_empresa_id());
CREATE POLICY "solic fornecedor select" ON public.solicitacoes
  FOR SELECT USING (
    public.has_role(auth.uid(), 'fornecedor')
    AND status = ANY (ARRAY['Aprovada'::text, 'Em Análise'::text, 'Concluída'::text])
  );

-- VIAGENS
DROP POLICY IF EXISTS "viag admin gestor all" ON public.viagens;
DROP POLICY IF EXISTS "viag motorista all"    ON public.viagens;

CREATE POLICY "viag admin all" ON public.viagens
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "viag gestor empresa" ON public.viagens
  FOR ALL USING (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id())
  WITH CHECK (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id());
CREATE POLICY "viag motorista own" ON public.viagens
  FOR ALL USING (motorista_id = auth.uid())
  WITH CHECK (motorista_id = auth.uid() AND empresa_id = public.get_empresa_id());

-- VEICULO_FOTOS
DROP POLICY IF EXISTS "fotos admin gestor all" ON public.veiculo_fotos;
DROP POLICY IF EXISTS "fotos motorista insert" ON public.veiculo_fotos;
DROP POLICY IF EXISTS "fotos motorista select" ON public.veiculo_fotos;

CREATE POLICY "fotos admin all" ON public.veiculo_fotos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fotos gestor empresa" ON public.veiculo_fotos
  FOR ALL USING (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id())
  WITH CHECK (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id());
CREATE POLICY "fotos motorista select" ON public.veiculo_fotos
  FOR SELECT USING (
    public.has_role(auth.uid(), 'motorista')
    AND EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_fotos.veiculo_id AND v.motorista_id = auth.uid())
  );
CREATE POLICY "fotos motorista insert" ON public.veiculo_fotos
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'motorista')
    AND EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_fotos.veiculo_id AND v.motorista_id = auth.uid())
  );

-- PERFIS (gestor vê perfis da própria empresa)
DROP POLICY IF EXISTS "perfis select self" ON public.perfis;
CREATE POLICY "perfis select self or empresa" ON public.perfis
  FOR SELECT USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'gestor_frota') AND empresa_id = public.get_empresa_id())
  );