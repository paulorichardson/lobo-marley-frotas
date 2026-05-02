-- get_perfil(): retorna o papel principal do usuário logado.
-- Mantém compatibilidade com o enum atual (admin, gestor_frota, fornecedor, motorista).
CREATE OR REPLACE FUNCTION public.get_perfil()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY
    CASE role::text
      WHEN 'admin' THEN 1
      WHEN 'gestor_frota' THEN 2
      WHEN 'fornecedor' THEN 3
      WHEN 'motorista' THEN 4
      ELSE 99
    END
  LIMIT 1;
$$;