
ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS codigo_autorizacao TEXT,
  ADD COLUMN IF NOT EXISTS confirmada_pelo_solicitante BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_envio_faturamento TIMESTAMPTZ;

CREATE SEQUENCE IF NOT EXISTS public.lm_codigo_seq START 1;

CREATE TABLE IF NOT EXISTS public.os_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manutencao_id UUID NOT NULL REFERENCES public.manutencoes(id) ON DELETE CASCADE,
  usuario_id UUID,
  perfil TEXT,
  acao TEXT NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_eventos_manut_idx ON public.os_eventos(manutencao_id);

ALTER TABLE public.os_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_eventos admin all"
  ON public.os_eventos FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "os_eventos envolvidos select"
  ON public.os_eventos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.manutencoes m
      WHERE m.id = os_eventos.manutencao_id
        AND (
          (public.has_role(auth.uid(), 'gestor_frota') AND m.empresa_id = public.get_empresa_id())
          OR (public.has_role(auth.uid(), 'fornecedor') AND m.fornecedor_id = auth.uid())
          OR m.solicitado_por = auth.uid()
        )
    )
  );

CREATE POLICY "os_eventos insert proprio"
  ON public.os_eventos FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

-- Trigger: gera código LM-XXXX e registra evento ao mudar status
CREATE OR REPLACE FUNCTION public.tg_os_status_evento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acao TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.os_eventos(manutencao_id, usuario_id, acao, observacao)
    VALUES (NEW.id, NEW.solicitado_por, 'criada', NEW.descricao);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Gera código de autorização ao aprovar
    IF NEW.status = 'Aprovada' AND NEW.codigo_autorizacao IS NULL THEN
      NEW.codigo_autorizacao := 'LM-' || lpad(nextval('public.lm_codigo_seq')::text, 4, '0');
    END IF;

    v_acao := CASE NEW.status
      WHEN 'Orçamento Enviado' THEN 'orcamento_enviado'
      WHEN 'Aguardando Aprovação' THEN 'orcamento_enviado'
      WHEN 'Aprovada' THEN 'aprovada'
      WHEN 'Em Andamento' THEN 'iniciada'
      WHEN 'Concluída' THEN 'finalizada'
      WHEN 'Faturamento' THEN 'enviada_faturamento'
      WHEN 'Recusada' THEN 'recusada'
      WHEN 'Cancelada' THEN 'cancelada'
      ELSE NEW.status
    END;
    INSERT INTO public.os_eventos(manutencao_id, usuario_id, acao)
    VALUES (NEW.id, auth.uid(), v_acao);
  END IF;

  IF NEW.confirmada_pelo_solicitante = true AND COALESCE(OLD.confirmada_pelo_solicitante, false) = false THEN
    INSERT INTO public.os_eventos(manutencao_id, usuario_id, acao)
    VALUES (NEW.id, auth.uid(), 'confirmada');
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS os_status_evento ON public.manutencoes;
CREATE TRIGGER os_status_evento
  BEFORE INSERT OR UPDATE OF status, confirmada_pelo_solicitante
  ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_os_status_evento();
