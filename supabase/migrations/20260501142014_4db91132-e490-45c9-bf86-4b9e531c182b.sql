-- Tabela de cadastro de fornecedores credenciados
CREATE TABLE public.fornecedores_cadastro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,

  -- Empresa
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text NOT NULL UNIQUE,
  tipos_fornecimento text[] NOT NULL DEFAULT '{}',
  telefone text,
  whatsapp text,

  -- Endereço
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,

  -- Bancário
  banco text,
  agencia text,
  conta text,
  tipo_conta text,
  pix_chave text,
  pix_tipo text,

  -- Responsável / acesso
  responsavel_nome text NOT NULL,
  responsavel_cpf text,
  responsavel_cargo text,
  email_login text NOT NULL,

  -- Aprovação
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','reprovado')),
  aprovado_por uuid,
  data_aprovacao timestamptz,
  motivo_reprovacao text,

  -- Termos
  aceitou_termos boolean NOT NULL DEFAULT false,
  aceitou_dados_bancarios boolean NOT NULL DEFAULT false,

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_forn_cad_status ON public.fornecedores_cadastro(status);
CREATE INDEX idx_forn_cad_user ON public.fornecedores_cadastro(user_id);

CREATE TRIGGER tg_forn_cad_updated
BEFORE UPDATE ON public.fornecedores_cadastro
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.fornecedores_cadastro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forn_cad admin all"
ON public.fornecedores_cadastro
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "forn_cad self select"
ON public.fornecedores_cadastro
FOR SELECT
USING (user_id = auth.uid());