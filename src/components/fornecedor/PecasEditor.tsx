import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";

export interface Peca {
  id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
}

interface Props {
  pecas: Peca[];
  onChange: (pecas: Peca[]) => void;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PecasEditor({ pecas, onChange }: Props) {
  function add() {
    onChange([
      ...pecas,
      { id: crypto.randomUUID(), descricao: "", quantidade: 1, valor_unitario: 0 },
    ]);
  }
  function update(id: string, patch: Partial<Peca>) {
    onChange(pecas.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function remove(id: string) {
    onChange(pecas.filter((p) => p.id !== id));
  }

  const total = pecas.reduce((s, p) => s + p.quantidade * p.valor_unitario, 0);

  return (
    <div className="space-y-2">
      {pecas.length === 0 && (
        <p className="text-xs text-muted-foreground py-2 text-center">
          Nenhuma peça adicionada.
        </p>
      )}
      {pecas.map((p) => {
        const sub = p.quantidade * p.valor_unitario;
        return (
          <div key={p.id} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-12 md:col-span-5">
              <Input
                placeholder="Descrição da peça"
                value={p.descricao}
                onChange={(e) => update(p.id, { descricao: e.target.value })}
                maxLength={150}
              />
            </div>
            <div className="col-span-3 md:col-span-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="Qtd"
                value={p.quantidade}
                onChange={(e) => update(p.id, { quantidade: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="Vlr unit"
                value={p.valor_unitario}
                onChange={(e) => update(p.id, { valor_unitario: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-4 md:col-span-2 text-right text-sm font-mono">
              {BRL(sub)}
            </div>
            <div className="col-span-1">
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(p.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar Peça
        </Button>
        <p className="text-sm">
          Total peças: <span className="font-bold font-mono">{BRL(total)}</span>
        </p>
      </div>
    </div>
  );
}
