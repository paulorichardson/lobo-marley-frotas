
CREATE OR REPLACE FUNCTION public.tg_alerta_revisao_km()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_marco TEXT;
  v_existe BOOLEAN;
  v_gestor UUID;
BEGIN
  IF NEW.km_proxima_revisao IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.km_atual >= (NEW.km_proxima_revisao - 500)
     AND (OLD.km_atual IS NULL OR OLD.km_atual < (NEW.km_proxima_revisao - 500)) THEN

    -- Notificação
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

    -- Criar solicitação automática (uma única vez por marco)
    v_marco := 'AUTO-PREV-' || NEW.km_proxima_revisao::text;

    SELECT EXISTS(
      SELECT 1 FROM public.solicitacoes
      WHERE veiculo_id = NEW.id
        AND descricao LIKE '%' || v_marco || '%'
    ) INTO v_existe;

    IF NOT v_existe THEN
      SELECT p.id INTO v_gestor
      FROM public.perfis p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.empresa_id = NEW.empresa_id
        AND ur.role = 'gestor_frota'::app_role
      LIMIT 1;

      INSERT INTO public.solicitacoes (
        empresa_id, veiculo_id, motorista_id, tipo_problema,
        descricao, urgencia, status
      ) VALUES (
        NEW.empresa_id,
        NEW.id,
        COALESCE(NEW.motorista_id, v_gestor, NEW.cadastrado_por),
        'Revisão preventiva',
        '[' || v_marco || '] Manutenção preventiva automática — Veículo ' || NEW.placa ||
        ' atingiu ' || NEW.km_atual::text || ' km (revisão programada para ' ||
        NEW.km_proxima_revisao::text || ' km).',
        'Alta',
        'Aberta'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_alerta_revisao_km ON public.veiculos;
CREATE TRIGGER trg_alerta_revisao_km
AFTER UPDATE OF km_atual ON public.veiculos
FOR EACH ROW EXECUTE FUNCTION public.tg_alerta_revisao_km();
