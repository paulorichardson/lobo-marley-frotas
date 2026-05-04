
-- ============ CONTRATOS POR CLIENTE ============
CREATE TABLE IF NOT EXISTS public.contratos_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_contrato TEXT,
  numero_processo TEXT,
  data_inicio DATE,
  data_fim DATE,
  valor_global NUMERIC(14,2) DEFAULT 0,
  tipo_taxa TEXT NOT NULL DEFAULT 'zero' CHECK (tipo_taxa IN ('positiva','zero','negativa')),
  percentual_taxa NUMERIC(6,3) NOT NULL DEFAULT 0,
  margem_minima NUMERIC(6,3) NOT NULL DEFAULT 0,
  margem_alerta NUMERIC(6,3) NOT NULL DEFAULT 0,
  permitir_prejuizo BOOLEAN NOT NULL DEFAULT false,
  exigir_justificativa BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS contratos_empresa_ativo_uidx
  ON public.contratos_clientes(empresa_id) WHERE ativo = true;

ALTER TABLE public.contratos_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos admin all"
  ON public.contratos_clientes
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- gestor pode SELECIONAR só dados básicos via view (saldo) — leitura limitada permitida
CREATE POLICY "contratos gestor select limitado"
  ON public.contratos_clientes
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'gestor_frota')
    AND empresa_id = public.get_empresa_id()
  );

CREATE TRIGGER contratos_updated
  BEFORE UPDATE ON public.contratos_clientes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ CAMPOS FINANCEIROS INTERNOS EM MANUTENCOES ============
ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS custo_fornecedor NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS valor_bruto_pecas NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS valor_bruto_servicos NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS percentual_aplicado NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS valor_liquido_faturavel NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS lucro_bruto NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS margem_percentual NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS status_financeiro TEXT DEFAULT 'pendente'
    CHECK (status_financeiro IN ('pendente','lucrativa','alerta','prejuizo','faturada')),
  ADD COLUMN IF NOT EXISTS justificativa_prejuizo TEXT,
  ADD COLUMN IF NOT EXISTS aprovado_admin_id UUID,
  ADD COLUMN IF NOT EXISTS numero_os TEXT;

-- ============ AUDITORIA FINANCEIRA ============
CREATE TABLE IF NOT EXISTS public.auditoria_financeira (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID,
  manutencao_id UUID,
  contrato_id UUID,
  usuario_id UUID,
  acao TEXT NOT NULL,
  valores_antes JSONB,
  valores_depois JSONB,
  justificativa TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auditoria_financeira ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria admin all"
  ON public.auditoria_financeira
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- inserts pelo próprio sistema (gestor cria OS, etc.) precisam ser permitidos
CREATE POLICY "auditoria insert proprio usuario"
  ON public.auditoria_financeira
  FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

-- ============ VIEW PÚBLICA DE MANUTENCOES (sem dados internos) ============
-- Esta view só expõe colunas seguras. Componentes para gestor/fornecedor/motorista
-- devem consultar `manutencoes_publicas`. Admins consultam a tabela base.
CREATE OR REPLACE VIEW public.manutencoes_publicas
WITH (security_invoker = on) AS
SELECT
  id, veiculo_id, fornecedor_id, solicitado_por, aprovado_por, empresa_id,
  tipo, descricao, status, prioridade,
  data_solicitacao, data_aprovacao, data_inicio, data_conclusao,
  km_na_manutencao, valor_previsto, valor_final,
  oficina_nome, nota_fiscal, comprovante_url, observacoes,
  criado_em, atualizado_em,
  diagnostico, servico_executado, aprovado_nome,
  valor_maximo_autorizado, prazo_esperado, exigir_orcamento,
  avaliacao_estrelas, avaliacao_comentario,
  solicitacao_pai_id, total_orcamentos_recebidos, enviado_para_rede,
  validade_orcamento, valor_mao_obra, desconto, os_oficina,
  numero_os
FROM public.manutencoes;

-- ============ FUNÇÃO DE CÁLCULO AUTOMÁTICO ============
CREATE OR REPLACE FUNCTION public.recalcular_financeiro_os(_manutencao_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp UUID;
  v_pecas NUMERIC := 0;
  v_servicos NUMERIC := 0;
  v_bruto NUMERIC := 0;
  v_custo NUMERIC := 0;
  v_liquido NUMERIC := 0;
  v_lucro NUMERIC := 0;
  v_margem NUMERIC := 0;
  v_pct NUMERIC := 0;
  v_tipo TEXT := 'zero';
  v_margem_min NUMERIC := 0;
  v_margem_alerta NUMERIC := 0;
  v_status TEXT := 'pendente';
BEGIN
  SELECT empresa_id, COALESCE(custo_fornecedor, valor_final, 0)
    INTO v_emp, v_custo
  FROM public.manutencoes WHERE id = _manutencao_id;

  IF v_emp IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(quantidade * valor_unitario), 0) INTO v_pecas
  FROM public.manutencao_pecas WHERE manutencao_id = _manutencao_id;

  SELECT COALESCE(valor_mao_obra, 0) INTO v_servicos
  FROM public.manutencoes WHERE id = _manutencao_id;

  v_bruto := v_pecas + v_servicos;

  SELECT tipo_taxa, percentual_taxa, margem_minima, margem_alerta
    INTO v_tipo, v_pct, v_margem_min, v_margem_alerta
  FROM public.contratos_clientes
  WHERE empresa_id = v_emp AND ativo = true
  LIMIT 1;

  IF v_tipo IS NULL THEN
    v_tipo := 'zero'; v_pct := 0; v_margem_min := 0; v_margem_alerta := 0;
  END IF;

  IF v_tipo = 'positiva' THEN
    v_liquido := v_bruto * (1 + v_pct/100.0);
  ELSIF v_tipo = 'negativa' THEN
    v_liquido := v_bruto * (1 - v_pct/100.0);
  ELSE
    v_liquido := v_bruto;
  END IF;

  v_lucro := v_liquido - v_custo;
  v_margem := CASE WHEN v_liquido > 0 THEN (v_lucro / v_liquido) * 100 ELSE 0 END;

  IF v_lucro < 0 THEN
    v_status := 'prejuizo';
  ELSIF v_margem < v_margem_alerta THEN
    v_status := 'alerta';
  ELSE
    v_status := 'lucrativa';
  END IF;

  UPDATE public.manutencoes SET
    valor_bruto_pecas = v_pecas,
    valor_bruto_servicos = v_servicos,
    percentual_aplicado = v_pct,
    valor_liquido_faturavel = v_liquido,
    lucro_bruto = v_lucro,
    margem_percentual = v_margem,
    status_financeiro = v_status,
    atualizado_em = now()
  WHERE id = _manutencao_id;
END;
$$;

-- Trigger para recalcular automaticamente quando manutenção é alterada
CREATE OR REPLACE FUNCTION public.tg_recalc_financeiro_manutencao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_financeiro_os(NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS recalc_fin_manut ON public.manutencoes;
CREATE TRIGGER recalc_fin_manut
  AFTER INSERT OR UPDATE OF valor_final, custo_fornecedor, valor_mao_obra, status
  ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_financeiro_manutencao();

-- Trigger para recalcular quando peças mudam
CREATE OR REPLACE FUNCTION public.tg_recalc_financeiro_pecas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_financeiro_os(COALESCE(NEW.manutencao_id, OLD.manutencao_id));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS recalc_fin_pecas ON public.manutencao_pecas;
CREATE TRIGGER recalc_fin_pecas
  AFTER INSERT OR UPDATE OR DELETE ON public.manutencao_pecas
  FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_financeiro_pecas();

-- ============ NUMERAÇÃO SEQUENCIAL DE OS ============
CREATE SEQUENCE IF NOT EXISTS public.os_numero_seq START 1;

CREATE OR REPLACE FUNCTION public.tg_atribui_numero_os()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero_os IS NULL THEN
    NEW.numero_os := 'OS-' || to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('public.os_numero_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS atribui_numero_os ON public.manutencoes;
CREATE TRIGGER atribui_numero_os
  BEFORE INSERT ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_atribui_numero_os();
