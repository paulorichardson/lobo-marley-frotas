import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, FileSignature, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Contrato = {
  id?: string;
  empresa_id: string;
  numero_contrato: string | null;
  numero_licitacao: string | null;
  numero_processo: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  valor_global: number;
  tipo_taxa: "positiva" | "zero" | "negativa";
  percentual_taxa: number;
  margem_minima: number;
  margem_alerta: number;
  permitir_prejuizo: boolean;
  exigir_justificativa: boolean;
  observacoes: string | null;
  ativo: boolean;
};

const VAZIO = (empresaId: string): Contrato => ({
  empresa_id: empresaId,
  numero_contrato: "",
  numero_licitacao: "",
  numero_processo: "",
  data_inicio: null,
  data_fim: null,
  valor_global: 0,
  tipo_taxa: "zero",
  percentual_taxa: 0,
  margem_minima: 10,
  margem_alerta: 15,
  permitir_prejuizo: false,
  exigir_justificativa: true,
  observacoes: "",
  ativo: true,
});

export function ContratoFinanceiroSection({ empresaId }: { empresaId: string }) {
  const [c, setC] = useState<Contrato>(VAZIO(empresaId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consumido, setConsumido] = useState(0);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("contratos_clientes")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .maybeSingle();
    if (data) setC(data as Contrato);
    else setC(VAZIO(empresaId));

    // consumo = soma de valor_liquido_faturavel das OS dentro do período
    const { data: os } = await supabase
      .from("manutencoes")
      .select("valor_liquido_faturavel, valor_final")
      .eq("empresa_id", empresaId);
    setConsumido((os ?? []).reduce(
      (s, r: any) => s + Number(r.valor_liquido_faturavel ?? r.valor_final ?? 0), 0,
    ));
    setLoading(false);
  }

  useEffect(() => { load(); }, [empresaId]);

  async function salvar() {
    setSaving(true);
    const payload = { ...c, empresa_id: empresaId };
    const { error } = c.id
      ? await supabase.from("contratos_clientes").update(payload).eq("id", c.id)
      : await supabase.from("contratos_clientes").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Contrato salvo");
    load();
  }

  if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;

  const saldo = (c.valor_global || 0) - consumido;
  const pctConsumo = c.valor_global > 0 ? (consumido / c.valor_global) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-amber-500/5 border-amber-500/30">
        <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
          <AlertTriangle className="w-4 h-4" />
          Acesso restrito ao Admin Lobo Marley
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Estas configurações regem cálculo de lucro, margem e bloqueios contratuais.
          Gestores e fornecedores não visualizam estes dados.
        </p>
      </Card>

      {/* SALDO CONTRATUAL */}
      {c.valor_global > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileSignature className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Saldo contratual</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Valor global</p>
              <p className="font-bold text-sm">R$ {c.valor_global.toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Consumido</p>
              <p className="font-bold text-sm">R$ {consumido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`font-bold text-sm ${saldo < 0 ? "text-rose-500" : "text-emerald-600"}`}>
                R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded overflow-hidden">
            <div
              className={`h-full ${pctConsumo > 90 ? "bg-rose-500" : pctConsumo > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, pctConsumo)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right mt-1">
            {pctConsumo.toFixed(1)}% utilizado
          </p>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">Dados do contrato</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Número do contrato</Label>
            <Input value={c.numero_contrato ?? ""} onChange={(e) => setC({ ...c, numero_contrato: e.target.value })} />
          </div>
          <div>
            <Label>Número do pregão / licitação</Label>
            <Input value={c.numero_licitacao ?? ""} onChange={(e) => setC({ ...c, numero_licitacao: e.target.value })} />
          </div>
          <div>
            <Label>Processo administrativo</Label>
            <Input value={c.numero_processo ?? ""} onChange={(e) => setC({ ...c, numero_processo: e.target.value })} />
          </div>
          <div>
            <Label>Data início</Label>
            <Input type="date" value={c.data_inicio ?? ""} onChange={(e) => setC({ ...c, data_inicio: e.target.value || null })} />
          </div>
          <div>
            <Label>Data fim</Label>
            <Input type="date" value={c.data_fim ?? ""} onChange={(e) => setC({ ...c, data_fim: e.target.value || null })} />
          </div>
          <div>
            <Label>Valor global (R$)</Label>
            <Input type="number" step="0.01" value={c.valor_global}
              onChange={(e) => setC({ ...c, valor_global: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">Taxa contratual</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Tipo de taxa</Label>
            <Select value={c.tipo_taxa} onValueChange={(v) => setC({ ...c, tipo_taxa: v as Contrato["tipo_taxa"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="positiva">Positiva (acréscimo)</SelectItem>
                <SelectItem value="zero">Zero (sem taxa)</SelectItem>
                <SelectItem value="negativa">Negativa (desconto)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Percentual (%)</Label>
            <Input type="number" step="0.001" value={c.percentual_taxa}
              onChange={(e) => setC({ ...c, percentual_taxa: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {c.tipo_taxa === "positiva" && `Cada OS será faturada com acréscimo de ${c.percentual_taxa}% sobre o valor bruto.`}
          {c.tipo_taxa === "zero" && "Sem alteração no valor bruto."}
          {c.tipo_taxa === "negativa" && `Cada OS será faturada com desconto de ${c.percentual_taxa}% sobre o valor bruto.`}
        </p>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">Proteção de margem</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Margem mínima (%)</Label>
            <Input type="number" step="0.1" value={c.margem_minima}
              onChange={(e) => setC({ ...c, margem_minima: parseFloat(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground mt-1">Abaixo disso a OS é classificada como prejuízo iminente.</p>
          </div>
          <div>
            <Label>Margem de alerta (%)</Label>
            <Input type="number" step="0.1" value={c.margem_alerta}
              onChange={(e) => setC({ ...c, margem_alerta: parseFloat(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground mt-1">Entre alerta e mínima exibe badge amarelo.</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <p className="font-medium text-sm">Permitir OS com prejuízo</p>
            <p className="text-xs text-muted-foreground">Se desligado, OS com prejuízo precisa de aprovação do Admin.</p>
          </div>
          <Switch checked={c.permitir_prejuizo} onCheckedChange={(v) => setC({ ...c, permitir_prejuizo: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Exigir justificativa</p>
            <p className="text-xs text-muted-foreground">Para aprovações fora dos limites contratuais.</p>
          </div>
          <Switch checked={c.exigir_justificativa} onCheckedChange={(v) => setC({ ...c, exigir_justificativa: v })} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <Label>Observações</Label>
        <Textarea rows={3} value={c.observacoes ?? ""}
          onChange={(e) => setC({ ...c, observacoes: e.target.value })} />
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar configuração contratual
        </Button>
      </div>
    </div>
  );
}
