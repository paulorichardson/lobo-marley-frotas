-- Campos SIGA-TCM
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS codigo_siga TEXT,
  ADD COLUMN IF NOT EXISTS tipo_combustivel_siga TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'veiculos_tipo_combustivel_siga_check') THEN
    ALTER TABLE public.veiculos
      ADD CONSTRAINT veiculos_tipo_combustivel_siga_check
      CHECK (tipo_combustivel_siga IS NULL OR tipo_combustivel_siga IN
        ('ALCOOL','GASOLINA','DIESEL','GNV','FLEX','ELETRICO','HIBRIDO'));
  END IF;
END $$;

ALTER TABLE public.abastecimentos
  ADD COLUMN IF NOT EXISTS numero_ticket TEXT,
  ADD COLUMN IF NOT EXISTS cpf_motorista TEXT;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS codigo_secretaria_siga TEXT;

-- Views com security_invoker para respeitar RLS das tabelas-base
CREATE OR REPLACE VIEW public.vw_siga_abastecimentos
WITH (security_invoker = true) AS
SELECT
  e.cnpj AS cnpj_prefeitura,
  TO_CHAR(a.data_hora, 'DD/MM/YYYY') AS data,
  v.placa,
  COALESCE(a.cpf_motorista, '') AS cpf_motorista,
  COALESCE(NULLIF(v.setor, ''), e.codigo_secretaria_siga, '') AS secretaria,
  COALESCE(v.tipo_combustivel_siga, UPPER(a.combustivel), 'FLEX') AS combustivel,
  ROUND(a.litros::numeric, 3) AS litros,
  ROUND(a.valor_litro::numeric, 4) AS valor_litro,
  COALESCE(a.numero_ticket, a.nota_fiscal, '') AS ticket,
  a.empresa_id,
  a.data_hora,
  v.setor AS setor_veiculo
FROM public.abastecimentos a
JOIN public.veiculos v ON v.id = a.veiculo_id
JOIN public.empresas e ON e.id = a.empresa_id;

CREATE OR REPLACE VIEW public.vw_siga_frota
WITH (security_invoker = true) AS
SELECT
  v.id,
  e.cnpj AS cnpj_prefeitura,
  COALESCE(NULLIF(v.setor, ''), e.codigo_secretaria_siga, '') AS secretaria,
  v.placa,
  UPPER(v.marca) AS marca,
  UPPER(v.modelo) AS modelo,
  COALESCE(v.ano_fabricacao::text, '') AS ano,
  COALESCE(v.tipo_combustivel_siga, UPPER(v.combustivel), 'FLEX') AS combustivel,
  v.empresa_id,
  v.setor AS setor_veiculo
FROM public.veiculos v
JOIN public.empresas e ON e.id = v.empresa_id
WHERE v.status = 'Ativo';