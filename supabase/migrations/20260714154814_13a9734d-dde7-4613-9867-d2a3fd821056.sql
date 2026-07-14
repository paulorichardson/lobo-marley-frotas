
-- 1) Remove duplicatas antigas das manutenções (mantém as mais recentes de 15:47)
DELETE FROM manutencoes
WHERE empresa_id = '8ef63fa8-3c5b-4d23-870e-181c9a2c3e21'
  AND (
    (nota_fiscal = '000.020.158' AND criado_em < '2026-07-14 15:40:00+00')
    OR (nota_fiscal = '000.020.160' AND criado_em < '2026-07-14 15:40:00+00')
  );

-- 2) Expande check constraint de categoria de veículos
ALTER TABLE public.veiculos DROP CONSTRAINT IF EXISTS veiculos_categoria_check;
ALTER TABLE public.veiculos ADD CONSTRAINT veiculos_categoria_check
  CHECK (categoria = ANY (ARRAY[
    'Carro','Caminhonete','Van','Ônibus','Micro-ônibus',
    'Caminhão','Caminhão Basculante','Caçamba',
    'Moto','Máquina',
    'Retroescavadeira','Pá Carregadeira','Escavadeira Hidráulica',
    'Motoniveladora (Patrol)','Trator de Esteira','Trator Agrícola',
    'Rolo Compactador','Empilhadeira','Munck','Betoneira',
    'Outro'
  ]));

-- 3) Atualiza categorias das máquinas recém-cadastradas
UPDATE public.veiculos SET categoria='Motoniveladora (Patrol)' WHERE placa='SEMPLACA-NH-RG170B';
UPDATE public.veiculos SET categoria='Pá Carregadeira'          WHERE placa='SEMPLACA-HYUNDAI-740-95';
UPDATE public.veiculos SET categoria='Retroescavadeira'         WHERE placa='SEMPLACA-JCB-3C';
UPDATE public.veiculos SET categoria='Caçamba'                  WHERE placa='SEMPLACA-CACAMBA-01';
