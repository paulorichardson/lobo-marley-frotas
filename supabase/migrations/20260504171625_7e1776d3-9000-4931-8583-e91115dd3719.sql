
-- Trigger 1: Alerta de revisão por KM
CREATE OR REPLACE FUNCTION public.tg_alerta_revisao_km()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.km_proxima_revisao IS NOT NULL
     AND NEW.km_atual >= (NEW.km_proxima_revisao - 500)
     AND (OLD.km_atual IS NULL OR OLD.km_atual < (NEW.km_proxima_revisao - 500)) THEN
    INSERT INTO public.notificacoes (para_id, titulo, mensagem, tipo, link)
    SELECT p.id,
      '🔧 Revisão próxima — ' || NEW.placa,
      'Veículo ' || NEW.placa || ' está a ' ||
      GREATEST(0, (NEW.km_proxima_revisao - NEW.km_atual))::text ||
      ' km da revisão programada.',
      'alerta',
      '/gestor/veiculos/' || NEW.id::text
    FROM public.perfis p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.empresa_id = NEW.empresa_id
      AND ur.role IN ('gestor_frota'::app_role, 'admin'::app_role);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_km_atualizado ON public.veiculos;
CREATE TRIGGER on_km_atualizado
  AFTER UPDATE OF km_atual ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.tg_alerta_revisao_km();

-- Trigger 2: Notificação de mudança de status da OS
CREATE OR REPLACE FUNCTION public.tg_notificar_status_os()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg TEXT;
  titulo TEXT;
  dest UUID;
  tipo_n TEXT := 'info';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'Aprovada' THEN
      titulo := '✅ OS Aprovada';
      msg := 'OS ' || COALESCE(NEW.numero_os, '') || ' foi aprovada pelo gestor.';
      dest := NEW.fornecedor_id;
      tipo_n := 'sucesso';
    ELSIF NEW.status = 'Concluída' THEN
      titulo := '🏁 OS Concluída';
      msg := 'OS ' || COALESCE(NEW.numero_os, '') || ' foi concluída pelo fornecedor.';
      dest := NEW.solicitado_por;
      tipo_n := 'sucesso';
    ELSIF NEW.status = 'Recusada' THEN
      titulo := '❌ OS Recusada';
      msg := 'OS ' || COALESCE(NEW.numero_os, '') || ' foi recusada.';
      dest := NEW.fornecedor_id;
      tipo_n := 'alerta';
    ELSIF NEW.status = 'Em Andamento' THEN
      titulo := '🔧 OS Iniciada';
      msg := 'O fornecedor iniciou a execução da OS ' || COALESCE(NEW.numero_os, '') || '.';
      dest := NEW.solicitado_por;
    ELSIF NEW.status = 'Faturamento' THEN
      titulo := '🧾 OS em Faturamento';
      msg := 'OS ' || COALESCE(NEW.numero_os, '') || ' foi enviada para faturamento.';
      dest := NEW.fornecedor_id;
    END IF;

    IF dest IS NOT NULL AND msg IS NOT NULL THEN
      INSERT INTO public.notificacoes (para_id, titulo, mensagem, tipo, link)
      VALUES (dest, titulo, msg, tipo_n, '/gestor/manutencoes');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_status_os_changed ON public.manutencoes;
CREATE TRIGGER on_status_os_changed
  AFTER UPDATE OF status ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_notificar_status_os();
