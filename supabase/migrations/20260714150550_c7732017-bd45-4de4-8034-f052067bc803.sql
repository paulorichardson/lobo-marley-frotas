
CREATE TABLE IF NOT EXISTS public.motoristas_cadastro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  matricula TEXT,
  nome TEXT NOT NULL,
  cargo TEXT,
  vinculo TEXT,
  secretaria TEXT,
  cnh_numero TEXT,
  cnh_categoria TEXT,
  cnh_vencimento DATE,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  perfil_id UUID,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motoristas_cadastro TO authenticated;
GRANT ALL ON public.motoristas_cadastro TO service_role;

ALTER TABLE public.motoristas_cadastro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver motoristas da empresa"
  ON public.motoristas_cadastro FOR SELECT
  TO authenticated
  USING (empresa_id = public.get_empresa_id() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores gerenciam motoristas da empresa"
  ON public.motoristas_cadastro FOR ALL
  TO authenticated
  USING (
    (empresa_id = public.get_empresa_id() AND public.has_any_role(auth.uid(), ARRAY['gestor_frota','admin']::app_role[]))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (empresa_id = public.get_empresa_id() AND public.has_any_role(auth.uid(), ARRAY['gestor_frota','admin']::app_role[]))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_motoristas_cadastro_empresa ON public.motoristas_cadastro(empresa_id);

CREATE TRIGGER trg_motoristas_cadastro_updated
  BEFORE UPDATE ON public.motoristas_cadastro
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
