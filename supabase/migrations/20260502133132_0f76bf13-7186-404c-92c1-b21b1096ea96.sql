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
  ORDER BY CASE role::text
    WHEN 'admin' THEN 1
    WHEN 'gestor_frota' THEN 2
    WHEN 'fornecedor' THEN 3
    WHEN 'motorista' THEN 4
    ELSE 5
  END
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_perfil() TO authenticated;