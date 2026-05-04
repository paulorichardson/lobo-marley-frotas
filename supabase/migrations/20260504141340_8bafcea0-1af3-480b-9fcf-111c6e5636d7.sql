-- Adicionar numero_licitacao ao contrato
ALTER TABLE public.contratos_clientes
  ADD COLUMN IF NOT EXISTS numero_licitacao text;

-- Tabela de anexos contratuais (somente admin)
CREATE TABLE IF NOT EXISTS public.contrato_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  contrato_id uuid,
  tipo_documento text NOT NULL,
  nome_arquivo text NOT NULL,
  url_arquivo text NOT NULL,
  storage_path text,
  tamanho_bytes bigint,
  usuario_upload uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anexos admin all" ON public.contrato_anexos
  FOR ALL TO public
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- Bucket privado para anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-anexos', 'contratos-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: somente admin
CREATE POLICY "contratos-anexos admin select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'contratos-anexos' AND public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "contratos-anexos admin insert" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'contratos-anexos' AND public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "contratos-anexos admin update" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id = 'contratos-anexos' AND public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "contratos-anexos admin delete" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id = 'contratos-anexos' AND public.has_role(auth.uid(),'admin'::app_role));
