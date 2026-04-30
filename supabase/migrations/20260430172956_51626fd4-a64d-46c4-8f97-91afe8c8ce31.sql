
-- =====================================================
-- ROLES (tabela separada por segurança)
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor_frota', 'fornecedor', 'motorista');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer para evitar recursão em RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS SETOF app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
$$;

-- =====================================================
-- PERFIS
-- =====================================================
CREATE TABLE public.perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at genérico
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$;

CREATE TRIGGER perfis_updated BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Trigger: cria perfil + role 'motorista' ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis (id, email, nome)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'motorista');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- VEÍCULOS
-- =====================================================
CREATE TABLE public.veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa TEXT NOT NULL UNIQUE,
  modelo TEXT NOT NULL,
  marca TEXT NOT NULL,
  ano_fabricacao INTEGER,
  ano_modelo INTEGER,
  cor TEXT,
  chassi TEXT,
  renavam TEXT,
  categoria TEXT CHECK (categoria IN ('Carro','Caminhonete','Van','Ônibus','Caminhão','Moto','Máquina','Outro')),
  combustivel TEXT DEFAULT 'Flex' CHECK (combustivel IN ('Gasolina','Diesel','Flex','Elétrico','GNV','Híbrido')),
  km_atual NUMERIC(12,1) NOT NULL DEFAULT 0,
  km_proxima_revisao NUMERIC(12,1),
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Em Manutenção','Inativo','Vendido')),
  vencimento_licenciamento DATE,
  vencimento_seguro DATE,
  vencimento_ipva DATE,
  foto_principal_url TEXT,
  doc_crlv_url TEXT,
  doc_seguro_url TEXT,
  motorista_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  cadastrado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_veiculos_motorista ON public.veiculos(motorista_id);
CREATE INDEX idx_veiculos_status ON public.veiculos(status);
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER veiculos_updated BEFORE UPDATE ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =====================================================
-- FOTOS DE VEÍCULOS
-- =====================================================
CREATE TABLE public.veiculo_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  legenda TEXT,
  tipo TEXT NOT NULL DEFAULT 'geral' CHECK (tipo IN ('geral','frontal','traseira','lateral_esq','lateral_dir','interior','dano','documento')),
  enviado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fotos_veiculo ON public.veiculo_fotos(veiculo_id);
ALTER TABLE public.veiculo_fotos ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CHECKLISTS
-- =====================================================
CREATE TABLE public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  motorista_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'saida' CHECK (tipo IN ('saida','retorno')),
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  km_registrado NUMERIC(12,1),
  pneus_ok BOOLEAN NOT NULL DEFAULT false,
  freios_ok BOOLEAN NOT NULL DEFAULT false,
  luzes_ok BOOLEAN NOT NULL DEFAULT false,
  agua_ok BOOLEAN NOT NULL DEFAULT false,
  oleo_ok BOOLEAN NOT NULL DEFAULT false,
  combustivel_ok BOOLEAN NOT NULL DEFAULT false,
  documentos_ok BOOLEAN NOT NULL DEFAULT false,
  lataria_ok BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  foto_hodometro_url TEXT,
  assinatura_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','reprovado')),
  aprovado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_check_veiculo ON public.checklists(veiculo_id);
CREATE INDEX idx_check_motorista ON public.checklists(motorista_id);
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ABASTECIMENTOS
-- =====================================================
CREATE TABLE public.abastecimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  motorista_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  km_atual NUMERIC(12,1) NOT NULL,
  litros NUMERIC(10,3) NOT NULL,
  valor_litro NUMERIC(10,4) NOT NULL,
  valor_total NUMERIC(12,2) GENERATED ALWAYS AS (litros * valor_litro) STORED,
  combustivel TEXT,
  posto TEXT,
  nota_fiscal TEXT,
  comprovante_url TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_abast_veiculo ON public.abastecimentos(veiculo_id);
ALTER TABLE public.abastecimentos ENABLE ROW LEVEL SECURITY;

-- Atualiza km do veículo
CREATE OR REPLACE FUNCTION public.atualizar_km_abastecimento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.veiculos
  SET km_atual = NEW.km_atual, atualizado_em = now()
  WHERE id = NEW.veiculo_id AND km_atual < NEW.km_atual;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_abastecimento_insert
  AFTER INSERT ON public.abastecimentos
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_km_abastecimento();

-- =====================================================
-- MANUTENÇÕES
-- =====================================================
CREATE TABLE public.manutencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  solicitado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  aprovado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Preventiva','Corretiva','Pneu','Elétrica','Funilaria','Revisão','Outro')),
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Solicitada' CHECK (status IN ('Solicitada','Aprovada','Em Execução','Concluída','Cancelada','Reprovada')),
  prioridade TEXT NOT NULL DEFAULT 'Normal' CHECK (prioridade IN ('Baixa','Normal','Alta','Urgente')),
  data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_aprovacao TIMESTAMPTZ,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  km_na_manutencao NUMERIC(12,1),
  valor_previsto NUMERIC(12,2),
  valor_final NUMERIC(12,2),
  oficina_nome TEXT,
  nota_fiscal TEXT,
  comprovante_url TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_manut_veiculo ON public.manutencoes(veiculo_id);
CREATE INDEX idx_manut_status ON public.manutencoes(status);
ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER manutencoes_updated BEFORE UPDATE ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =====================================================
-- DESPESAS
-- =====================================================
CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  lancado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Multa','Pedágio','Estacionamento','IPVA','Licenciamento','Seguro','Outro')),
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL,
  data_despesa DATE NOT NULL DEFAULT CURRENT_DATE,
  comprovante_url TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_desp_veiculo ON public.despesas(veiculo_id);
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SOLICITAÇÕES
-- =====================================================
CREATE TABLE public.solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  motorista_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  tipo_problema TEXT NOT NULL,
  descricao TEXT NOT NULL,
  urgencia TEXT NOT NULL DEFAULT 'Normal' CHECK (urgencia IN ('Baixa','Normal','Alta','Urgente')),
  foto_url TEXT,
  status TEXT NOT NULL DEFAULT 'Aberta' CHECK (status IN ('Aberta','Em Análise','Aprovada','Reprovada','Concluída')),
  resposta_gestor TEXT,
  manutencao_id UUID REFERENCES public.manutencoes(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_solic_motorista ON public.solicitacoes(motorista_id);
ALTER TABLE public.solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER solicitacoes_updated BEFORE UPDATE ON public.solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =====================================================
-- VIAGENS
-- =====================================================
CREATE TABLE public.viagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  motorista_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  destino TEXT,
  finalidade TEXT,
  km_saida NUMERIC(12,1),
  km_chegada NUMERIC(12,1),
  km_percorrido NUMERIC(12,1) GENERATED ALWAYS AS (
    CASE WHEN km_chegada IS NOT NULL THEN km_chegada - km_saida ELSE NULL END
  ) STORED,
  data_saida TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_chegada TIMESTAMPTZ,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_viag_veiculo ON public.viagens(veiculo_id);
ALTER TABLE public.viagens ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- NOTIFICAÇÕES
-- =====================================================
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  para_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info' CHECK (tipo IN ('info','alerta','urgente','aprovacao')),
  lida BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_para ON public.notificacoes(para_id, lida);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS
-- =====================================================

-- USER_ROLES
CREATE POLICY "user_roles select self or admin" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles admin manage" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PERFIS
CREATE POLICY "perfis select self" ON public.perfis FOR SELECT
  USING (id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]));
CREATE POLICY "perfis update self" ON public.perfis FOR UPDATE
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "perfis admin all" ON public.perfis FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- VEÍCULOS
CREATE POLICY "veiculos admin gestor all" ON public.veiculos FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]));
CREATE POLICY "veiculos motorista select" ON public.veiculos FOR SELECT
  USING (public.has_role(auth.uid(), 'motorista') AND motorista_id = auth.uid());
CREATE POLICY "veiculos fornecedor select" ON public.veiculos FOR SELECT
  USING (public.has_role(auth.uid(), 'fornecedor'));

-- FOTOS
CREATE POLICY "fotos admin gestor all" ON public.veiculo_fotos FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]));
CREATE POLICY "fotos motorista insert" ON public.veiculo_fotos FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'motorista')
    AND EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.motorista_id = auth.uid())
  );
CREATE POLICY "fotos motorista select" ON public.veiculo_fotos FOR SELECT
  USING (
    public.has_role(auth.uid(), 'motorista')
    AND EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.motorista_id = auth.uid())
  );

-- CHECKLISTS
CREATE POLICY "check admin gestor all" ON public.checklists FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]));
CREATE POLICY "check motorista all" ON public.checklists FOR ALL
  USING (motorista_id = auth.uid())
  WITH CHECK (motorista_id = auth.uid());

-- ABASTECIMENTOS
CREATE POLICY "abast admin gestor all" ON public.abastecimentos FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]));
CREATE POLICY "abast fornecedor insert" ON public.abastecimentos FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'fornecedor') AND fornecedor_id = auth.uid());
CREATE POLICY "abast fornecedor select" ON public.abastecimentos FOR SELECT
  USING (public.has_role(auth.uid(), 'fornecedor') AND fornecedor_id = auth.uid());
CREATE POLICY "abast motorista insert" ON public.abastecimentos FOR INSERT
  WITH CHECK (motorista_id = auth.uid());
CREATE POLICY "abast motorista select" ON public.abastecimentos FOR SELECT
  USING (motorista_id = auth.uid());

-- MANUTENÇÕES
CREATE POLICY "manut admin gestor all" ON public.manutencoes FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]));
CREATE POLICY "manut fornecedor own" ON public.manutencoes FOR ALL
  USING (public.has_role(auth.uid(), 'fornecedor') AND fornecedor_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'fornecedor') AND fornecedor_id = auth.uid());
CREATE POLICY "manut motorista select" ON public.manutencoes FOR SELECT
  USING (solicitado_por = auth.uid());

-- DESPESAS
CREATE POLICY "desp admin gestor all" ON public.despesas FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]));
CREATE POLICY "desp fornecedor insert" ON public.despesas FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'fornecedor') AND lancado_por = auth.uid());
CREATE POLICY "desp fornecedor select" ON public.despesas FOR SELECT
  USING (public.has_role(auth.uid(), 'fornecedor') AND lancado_por = auth.uid());

-- SOLICITAÇÕES
CREATE POLICY "solic admin gestor all" ON public.solicitacoes FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]));
CREATE POLICY "solic motorista all" ON public.solicitacoes FOR ALL
  USING (motorista_id = auth.uid())
  WITH CHECK (motorista_id = auth.uid());
CREATE POLICY "solic fornecedor select" ON public.solicitacoes FOR SELECT
  USING (public.has_role(auth.uid(), 'fornecedor') AND status IN ('Aprovada','Em Análise','Concluída'));

-- VIAGENS
CREATE POLICY "viag admin gestor all" ON public.viagens FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','gestor_frota']::app_role[]));
CREATE POLICY "viag motorista all" ON public.viagens FOR ALL
  USING (motorista_id = auth.uid())
  WITH CHECK (motorista_id = auth.uid());

-- NOTIFICAÇÕES
CREATE POLICY "notif own" ON public.notificacoes FOR ALL
  USING (para_id = auth.uid())
  WITH CHECK (para_id = auth.uid());

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('veiculos-fotos', 'veiculos-fotos', false),
  ('veiculos-docs', 'veiculos-docs', false),
  ('comprovantes', 'comprovantes', false),
  ('checklists-fotos', 'checklists-fotos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas storage: usuários autenticados podem ler/gravar nos buckets do app
CREATE POLICY "storage_app_read" ON storage.objects FOR SELECT
  USING (auth.uid() IS NOT NULL AND bucket_id IN ('veiculos-fotos','veiculos-docs','comprovantes','checklists-fotos'));
CREATE POLICY "storage_app_insert" ON storage.objects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND bucket_id IN ('veiculos-fotos','veiculos-docs','comprovantes','checklists-fotos'));
CREATE POLICY "storage_app_update" ON storage.objects FOR UPDATE
  USING (auth.uid() IS NOT NULL AND bucket_id IN ('veiculos-fotos','veiculos-docs','comprovantes','checklists-fotos'));
CREATE POLICY "storage_app_delete" ON storage.objects FOR DELETE
  USING (auth.uid() IS NOT NULL AND bucket_id IN ('veiculos-fotos','veiculos-docs','comprovantes','checklists-fotos'));
