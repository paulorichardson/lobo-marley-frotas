export const COMBUSTIVEIS = ["Gasolina", "Diesel", "Flex", "Elétrico", "GNV", "Híbrido"] as const;
export const CATEGORIAS = ["Carro", "Caminhonete", "Van", "Ônibus", "Caminhão", "Moto", "Máquina", "Outro"] as const;
export const STATUS_VEICULO = ["Ativo", "Em Manutenção", "Inativo", "Vendido"] as const;

export const TIPOS_BEM = [
  { value: "veiculo", label: "🚗 Veículo (com placa)", placaLabel: "Placa", placaPlaceholder: "AAA-0000", validaPlaca: true, usaHorimetro: false, mostraDocs: true },
  { value: "maquina", label: "🚜 Máquina pesada", placaLabel: "Identificação / Patrimônio", placaPlaceholder: "TR-001", validaPlaca: false, usaHorimetro: true, mostraDocs: false },
  { value: "implemento", label: "🔧 Implemento agrícola", placaLabel: "Identificação / Patrimônio", placaPlaceholder: "IM-001", validaPlaca: false, usaHorimetro: false, mostraDocs: false },
  { value: "equipamento", label: "⚙️ Equipamento", placaLabel: "Identificação / Patrimônio", placaPlaceholder: "EQ-001", validaPlaca: false, usaHorimetro: true, mostraDocs: false },
] as const;

export type TipoBem = typeof TIPOS_BEM[number]["value"];

export function getTipoBem(value: string) {
  return TIPOS_BEM.find((t) => t.value === value) ?? TIPOS_BEM[0];
}

export const TIPOS_FOTO = [
  { value: "frontal", label: "Frontal" },
  { value: "traseira", label: "Traseira" },
  { value: "lateral_esq", label: "Lateral esquerda" },
  { value: "lateral_dir", label: "Lateral direita" },
  { value: "interior", label: "Interior" },
  { value: "dano", label: "Dano" },
  { value: "geral", label: "Geral" },
] as const;

export function statusBadgeVariant(status: string): { className: string; label: string } {
  switch (status) {
    case "Ativo":
      return { className: "bg-success/15 text-success border-success/30", label: "Ativo" };
    case "Em Manutenção":
      return { className: "bg-warning/15 text-warning border-warning/30", label: "Em Manutenção" };
    case "Inativo":
      return { className: "bg-muted text-muted-foreground border-border", label: "Inativo" };
    case "Vendido":
      return { className: "bg-destructive/15 text-destructive border-destructive/30", label: "Vendido" };
    default:
      return { className: "bg-muted text-muted-foreground border-border", label: status };
  }
}

// Retorna true se a data está em <30 dias OU já venceu
export function vencendoEmBreve(dataIso: string | null | undefined): boolean {
  if (!dataIso) return false;
  const d = new Date(dataIso);
  const diffDays = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diffDays < 30;
}

export function veiculoTemAlerta(v: {
  vencimento_licenciamento?: string | null;
  vencimento_ipva?: string | null;
  vencimento_seguro?: string | null;
}): boolean {
  return (
    vencendoEmBreve(v.vencimento_licenciamento) ||
    vencendoEmBreve(v.vencimento_ipva) ||
    vencendoEmBreve(v.vencimento_seguro)
  );
}
