-- 1) Permitir abastecimentos de "Outros Bens" (sem veículo)
ALTER TABLE public.abastecimentos
  ALTER COLUMN veiculo_id DROP NOT NULL,
  ALTER COLUMN km_atual DROP NOT NULL;

ALTER TABLE public.abastecimentos
  ADD COLUMN IF NOT EXISTS bem_descricao text,
  ADD COLUMN IF NOT EXISTS bem_identificacao text;

-- Garante consistência: ou veículo, ou descrição do bem
ALTER TABLE public.abastecimentos
  DROP CONSTRAINT IF EXISTS abast_alvo_chk;
ALTER TABLE public.abastecimentos
  ADD CONSTRAINT abast_alvo_chk
  CHECK (veiculo_id IS NOT NULL OR bem_descricao IS NOT NULL);

-- Política específica para fornecedor inserir abastecimento de "outros bens" (sem empresa_id)
DROP POLICY IF EXISTS "abast fornecedor insert outros" ON public.abastecimentos;
CREATE POLICY "abast fornecedor insert outros"
ON public.abastecimentos
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'fornecedor'::app_role)
  AND fornecedor_id = auth.uid()
  AND veiculo_id IS NULL
  AND bem_descricao IS NOT NULL
);

-- 2) Logo do fornecedor (campo no cadastro)
ALTER TABLE public.fornecedores_cadastro
  ADD COLUMN IF NOT EXISTS logo_url text;

-- 3) Bucket público para logos de fornecedor
INSERT INTO storage.buckets (id, name, public)
VALUES ('fornecedores-logos', 'fornecedores-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket logos: público para leitura, fornecedor escreve no próprio prefixo
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'fornecedores-logos');

DROP POLICY IF EXISTS "logos fornecedor write" ON storage.objects;
CREATE POLICY "logos fornecedor write"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fornecedores-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "logos fornecedor update" ON storage.objects;
CREATE POLICY "logos fornecedor update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'fornecedores-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4) Garantir realtime nas notificações (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notificacoes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes';
  END IF;
END $$;

ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;