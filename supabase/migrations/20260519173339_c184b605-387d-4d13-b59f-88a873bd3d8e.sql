
-- Tabela de laudos de vistoria
CREATE TABLE public.laudos_vistoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID,
  veiculo_id UUID NOT NULL,
  vistoriador_id UUID,
  tipo TEXT NOT NULL DEFAULT 'periodica', -- entrega | devolucao | periodica | sinistro
  data_vistoria TIMESTAMPTZ NOT NULL DEFAULT now(),
  km_registrado NUMERIC,
  local_vistoria TEXT,
  responsavel_nome TEXT,
  responsavel_documento TEXT,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  avarias JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{lado, x, y, tipo, descricao, severidade}]
  fotos JSONB NOT NULL DEFAULT '[]'::jsonb,      -- [{slot, path, legenda}]
  observacoes TEXT,
  assinatura_vistoriador_path TEXT,
  assinatura_responsavel_path TEXT,
  status TEXT NOT NULL DEFAULT 'concluido',      -- rascunho | concluido | cancelado
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_laudos_empresa ON public.laudos_vistoria(empresa_id);
CREATE INDEX idx_laudos_veiculo ON public.laudos_vistoria(veiculo_id);

ALTER TABLE public.laudos_vistoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "laudos admin all" ON public.laudos_vistoria
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "laudos gestor empresa" ON public.laudos_vistoria
  FOR ALL USING (has_role(auth.uid(), 'gestor_frota'::app_role) AND empresa_id = get_empresa_id())
  WITH CHECK (has_role(auth.uid(), 'gestor_frota'::app_role) AND empresa_id = get_empresa_id());

CREATE POLICY "laudos motorista select" ON public.laudos_vistoria
  FOR SELECT USING (
    has_role(auth.uid(), 'motorista'::app_role)
    AND EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = laudos_vistoria.veiculo_id AND v.motorista_id = auth.uid())
  );

CREATE TRIGGER trg_laudos_updated
  BEFORE UPDATE ON public.laudos_vistoria
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('laudos-fotos', 'laudos-fotos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "laudos-fotos admin all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'laudos-fotos' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'laudos-fotos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "laudos-fotos gestor"
  ON storage.objects FOR ALL
  USING (bucket_id = 'laudos-fotos' AND has_role(auth.uid(), 'gestor_frota'::app_role))
  WITH CHECK (bucket_id = 'laudos-fotos' AND has_role(auth.uid(), 'gestor_frota'::app_role));

CREATE POLICY "laudos-fotos motorista select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'laudos-fotos' AND has_role(auth.uid(), 'motorista'::app_role));
