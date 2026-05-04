-- Corrigir trigger que tentava inserir em os_eventos antes da manutenção existir
DROP TRIGGER IF EXISTS os_status_evento ON public.manutencoes;

CREATE TRIGGER os_status_evento_ins
  AFTER INSERT ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_os_status_evento();

CREATE TRIGGER os_status_evento_upd
  BEFORE UPDATE OF status, confirmada_pelo_solicitante ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_os_status_evento();