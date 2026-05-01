import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Wrench, Disc, Cog, Zap, Droplets, Circle, Stethoscope, SprayCan, Package } from "lucide-react";

export type TipoServicoChave =
  | "motor" | "freio" | "suspensao" | "eletrica"
  | "troca_oleo" | "pneus" | "diagnostico" | "funilaria" | "outros";

type ItemDef = { id: string; label: string };

const CHECKLISTS: Record<TipoServicoChave, { titulo: string; icone: any; itens: ItemDef[] }> = {
  motor: {
    titulo: "Motor",
    icone: Cog,
    itens: [
      { id: "compressao", label: "Verificação de compressão" },
      { id: "correia", label: "Correia dentada / acessórios" },
      { id: "velas", label: "Velas / cabos de ignição" },
      { id: "filtro_ar", label: "Filtro de ar" },
      { id: "filtro_combustivel", label: "Filtro de combustível" },
      { id: "vazamentos", label: "Inspeção de vazamentos" },
    ],
  },
  freio: {
    titulo: "Freios",
    icone: Disc,
    itens: [
      { id: "pastilhas", label: "Pastilhas dianteiras" },
      { id: "lonas", label: "Lonas / sapatas traseiras" },
      { id: "discos", label: "Discos / tambores" },
      { id: "fluido", label: "Fluido de freio" },
      { id: "mangueiras", label: "Mangueiras e tubulações" },
      { id: "freio_estacionamento", label: "Freio de estacionamento" },
    ],
  },
  suspensao: {
    titulo: "Suspensão",
    icone: Wrench,
    itens: [
      { id: "amortecedores", label: "Amortecedores" },
      { id: "molas", label: "Molas / batentes" },
      { id: "buchas", label: "Buchas e pivôs" },
      { id: "barra_estab", label: "Barra estabilizadora" },
      { id: "alinhamento", label: "Alinhamento e cambagem" },
    ],
  },
  eletrica: {
    titulo: "Elétrica",
    icone: Zap,
    itens: [
      { id: "bateria", label: "Bateria e terminais" },
      { id: "alternador", label: "Alternador" },
      { id: "motor_partida", label: "Motor de partida" },
      { id: "iluminacao", label: "Iluminação externa/interna" },
      { id: "fusiveis", label: "Fusíveis e relés" },
      { id: "scanner", label: "Leitura de códigos (scanner)" },
    ],
  },
  troca_oleo: {
    titulo: "Troca de Óleo",
    icone: Droplets,
    itens: [
      { id: "oleo_motor", label: "Óleo do motor trocado" },
      { id: "filtro_oleo", label: "Filtro de óleo trocado" },
      { id: "nivel_arrefecimento", label: "Nível do arrefecimento" },
      { id: "nivel_freio", label: "Nível fluido de freio" },
      { id: "nivel_direcao", label: "Nível direção hidráulica" },
      { id: "lubrificacao", label: "Lubrificação geral" },
    ],
  },
  pneus: {
    titulo: "Pneus",
    icone: Circle,
    itens: [
      { id: "calibragem", label: "Calibragem" },
      { id: "rodizio", label: "Rodízio" },
      { id: "balanceamento", label: "Balanceamento" },
      { id: "alinhamento", label: "Alinhamento" },
      { id: "estepe", label: "Estepe verificado" },
      { id: "desgaste", label: "Inspeção de desgaste" },
    ],
  },
  diagnostico: {
    titulo: "Diagnóstico",
    icone: Stethoscope,
    itens: [
      { id: "scanner", label: "Scanner OBD" },
      { id: "test_drive", label: "Test drive" },
      { id: "ruidos", label: "Identificação de ruídos" },
      { id: "vazamentos", label: "Vazamentos" },
      { id: "relatorio", label: "Relatório técnico emitido" },
    ],
  },
  funilaria: {
    titulo: "Funilaria/Pintura",
    icone: SprayCan,
    itens: [
      { id: "lataria", label: "Reparo de lataria" },
      { id: "massa", label: "Aplicação de massa" },
      { id: "pintura", label: "Pintura" },
      { id: "polimento", label: "Polimento" },
      { id: "vidros", label: "Vidros e borrachas" },
    ],
  },
  outros: {
    titulo: "Outros",
    icone: Package,
    itens: [
      { id: "servico_geral", label: "Serviço geral conforme solicitado" },
      { id: "limpeza", label: "Limpeza pós-serviço" },
      { id: "teste_final", label: "Teste final realizado" },
    ],
  },
};

export const TIPOS_SERVICO_CHAVES: { chave: TipoServicoChave; titulo: string; icone: any }[] =
  (Object.entries(CHECKLISTS) as [TipoServicoChave, typeof CHECKLISTS[TipoServicoChave]][])
    .map(([chave, def]) => ({ chave, titulo: def.titulo, icone: def.icone }));

export function getChecklistItens(tipo: TipoServicoChave): ItemDef[] {
  return CHECKLISTS[tipo]?.itens ?? [];
}

export function ChecklistServico({
  tipo,
  marcados,
  onChange,
}: {
  tipo: TipoServicoChave;
  marcados: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  const def = CHECKLISTS[tipo];
  if (!def) return null;
  const Icon = def.icone;
  const total = def.itens.length;
  const feitos = def.itens.filter((i) => marcados[i.id]).length;

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">Checklist {def.titulo}</p>
        </div>
        <span className="text-xs text-muted-foreground">{feitos}/{total}</span>
      </div>
      <div className="space-y-1.5">
        {def.itens.map((item) => (
          <Label
            key={item.id}
            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
          >
            <Checkbox
              checked={!!marcados[item.id]}
              onCheckedChange={(v) => onChange({ ...marcados, [item.id]: !!v })}
            />
            <span className="text-sm font-normal">{item.label}</span>
          </Label>
        ))}
      </div>
    </Card>
  );
}
