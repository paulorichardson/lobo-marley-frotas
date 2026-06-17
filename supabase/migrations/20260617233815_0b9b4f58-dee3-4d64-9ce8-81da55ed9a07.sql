
-- 1) fornecedores_externos: scope gestor SELECT to same empresa via creator
DROP POLICY IF EXISTS "forn_ext gestor select" ON public.fornecedores_externos;
CREATE POLICY "forn_ext gestor select" ON public.fornecedores_externos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gestor_frota'::app_role)
  AND (
    criado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.perfis p
      WHERE p.id = fornecedores_externos.criado_por
        AND p.empresa_id = get_empresa_id()
    )
  )
);

-- 2) solicitacoes: scope fornecedor SELECT to requests with a manutencao assigned to them
DROP POLICY IF EXISTS "solic fornecedor select" ON public.solicitacoes;
CREATE POLICY "solic fornecedor select" ON public.solicitacoes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'fornecedor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.manutencoes m
    WHERE m.id = solicitacoes.manutencao_id
      AND m.fornecedor_id = auth.uid()
  )
);

-- 3) auditoria_financeira: stricter INSERT + gestor SELECT
DROP POLICY IF EXISTS "auditoria insert proprio usuario" ON public.auditoria_financeira;
CREATE POLICY "auditoria insert proprio usuario" ON public.auditoria_financeira
FOR INSERT TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (empresa_id IS NOT NULL AND empresa_id = get_empresa_id())
  )
);

CREATE POLICY "auditoria gestor empresa select" ON public.auditoria_financeira
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gestor_frota'::app_role)
  AND empresa_id = get_empresa_id()
);

-- 4) contrato_anexos: gestor of empresa can read
CREATE POLICY "anexos gestor empresa select" ON public.contrato_anexos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gestor_frota'::app_role)
  AND empresa_id = get_empresa_id()
);

-- 5) Storage: notas-fornecedores — admin only (only admin import flow uses it)
DROP POLICY IF EXISTS "Autenticados gerenciam notas fornecedores" ON storage.objects;
CREATE POLICY "notas-fornecedores admin all" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'notas-fornecedores' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'notas-fornecedores' AND has_role(auth.uid(), 'admin'::app_role));

-- 6) Storage: limit app buckets to app roles (admin/gestor/fornecedor/motorista)
DROP POLICY IF EXISTS "storage_app_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_app_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_app_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_app_delete" ON storage.objects;

CREATE POLICY "storage_app_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = ANY (ARRAY['veiculos-fotos','veiculos-docs','comprovantes','checklists-fotos'])
  AND has_any_role(auth.uid(), ARRAY['admin','gestor_frota','fornecedor','motorista']::app_role[])
);
CREATE POLICY "storage_app_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = ANY (ARRAY['veiculos-fotos','veiculos-docs','comprovantes','checklists-fotos'])
  AND has_any_role(auth.uid(), ARRAY['admin','gestor_frota','fornecedor','motorista']::app_role[])
);
CREATE POLICY "storage_app_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = ANY (ARRAY['veiculos-fotos','veiculos-docs','comprovantes','checklists-fotos'])
  AND has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[])
);
CREATE POLICY "storage_app_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = ANY (ARRAY['veiculos-fotos','veiculos-docs','comprovantes','checklists-fotos'])
  AND has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[])
);

-- 7) SECURITY DEFINER functions: revoke broad EXECUTE on internal ones
REVOKE EXECUTE ON FUNCTION public.recalcular_financeiro_os(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atualizar_km_abastecimento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notificar_status_os() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_atribui_numero_os() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_os_status_evento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_recalc_financeiro_manutencao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_recalc_financeiro_pecas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_atribui_numero_fatura() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_alerta_revisao_km() FROM PUBLIC, anon, authenticated;

-- helper role-check functions: keep available to authenticated, revoke from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_roles() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_empresa_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_perfil() FROM anon;
