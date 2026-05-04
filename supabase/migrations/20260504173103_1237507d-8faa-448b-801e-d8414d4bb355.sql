ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_tipo_check
  CHECK (tipo = ANY (ARRAY['info','alerta','urgente','aprovacao','sucesso']));