
-- 1) tabela unidades
CREATE TABLE public.unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'secretaria',
  sigla TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  responsavel_nome TEXT,
  responsavel_cargo TEXT,
  responsavel_telefone TEXT,
  responsavel_email TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  faturamento_separado BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unidades_tipo_check CHECK (tipo IN ('secretaria','fundo','orgao','autarquia','departamento'))
);

CREATE INDEX idx_unidades_empresa ON public.unidades(empresa_id);
CREATE INDEX idx_unidades_cnpj ON public.unidades(cnpj) WHERE cnpj IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unidades admin all" ON public.unidades
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "unidades gestor select" ON public.unidades
  FOR SELECT USING (
    public.has_role(auth.uid(), 'gestor_frota'::app_role)
    AND empresa_id = public.get_empresa_id()
  );

CREATE POLICY "unidades gestor update" ON public.unidades
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'gestor_frota'::app_role)
    AND empresa_id = public.get_empresa_id()
  ) WITH CHECK (
    public.has_role(auth.uid(), 'gestor_frota'::app_role)
    AND empresa_id = public.get_empresa_id()
  );

-- também motorista/fornecedor precisam ler o nome da unidade do veículo
CREATE POLICY "unidades leitura autenticados mesma empresa" ON public.unidades
  FOR SELECT USING (
    empresa_id = public.get_empresa_id()
  );

CREATE TRIGGER unidades_updated BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) vínculo em veiculos
ALTER TABLE public.veiculos
  ADD COLUMN unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL;
CREATE INDEX idx_veiculos_unidade ON public.veiculos(unidade_id);

-- 3) vínculo em contratos_clientes (contrato pode ser da empresa OU de uma unidade)
ALTER TABLE public.contratos_clientes
  ADD COLUMN unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE;
CREATE INDEX idx_contratos_unidade ON public.contratos_clientes(unidade_id);

-- ajusta unique: apenas 1 contrato ativo por (empresa, unidade)
DROP INDEX IF EXISTS public.contratos_empresa_ativo_uidx;
CREATE UNIQUE INDEX contratos_empresa_unidade_ativo_uidx
  ON public.contratos_clientes(empresa_id, COALESCE(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE ativo = true;

-- 4) vínculo em faturas
ALTER TABLE public.faturas
  ADD COLUMN unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL;
CREATE INDEX idx_faturas_unidade ON public.faturas(unidade_id);
