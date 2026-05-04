import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";

type V = { id: string; placa: string; marca: string; modelo: string; motorista_id: string | null; empresa_id: string | null };
type M = { id: string; nome: string; empresa_id: string | null };

export function VincularMotoristasModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [veiculos, setVeiculos] = useState<V[]>([]);
  const [motoristas, setMotoristas] = useState<M[]>([]);
  const [changes, setChanges] = useState<Record<string, string | null>>({});
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [v, p, r] = await Promise.all([
        supabase.from("veiculos").select("id, placa, marca, modelo, motorista_id, empresa_id").order("placa"),
        supabase.from("perfis").select("id, nome, empresa_id").eq("ativo", true).order("nome"),
        supabase.from("user_roles").select("user_id, role").eq("role", "motorista"),
      ]);
      const motoristaIds = new Set((r.data ?? []).map((x: any) => x.user_id));
      setVeiculos((v.data ?? []) as V[]);
      setMotoristas(((p.data ?? []) as M[]).filter((m) => motoristaIds.has(m.id)));
      setChanges({});
      setLoading(false);
    })();
  }, [open]);

  function setVal(vid: string, mid: string) {
    setChanges((c) => ({ ...c, [vid]: mid === "__none__" ? null : mid }));
  }

  async function salvar() {
    setSaving(true);
    const entries = Object.entries(changes);
    let ok = 0, err = 0;
    for (const [vid, mid] of entries) {
      const { error } = await supabase.from("veiculos").update({ motorista_id: mid }).eq("id", vid);
      if (error) err++; else ok++;
    }
    setSaving(false);
    if (err) toast.error(`${err} erro(s) ao salvar`);
    if (ok) toast.success(`${ok} veículo(s) atualizado(s)`);
    onSaved();
    onClose();
  }

  const semMotorista = veiculos.filter((v) => !v.motorista_id && !changes[v.id]).length;
  const filtrados = veiculos.filter((v) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return `${v.placa} ${v.marca} ${v.modelo}`.toLowerCase().includes(q);
  });

  function nomePor(id: string | null | undefined) {
    if (!id) return "—";
    return motoristas.find((m) => m.id === id)?.nome ?? id.slice(0, 8);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>🔗 Vincular motoristas aos veículos</DialogTitle>
        </DialogHeader>

        {semMotorista > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded p-2 text-sm">
            ⚠ <strong>{semMotorista}</strong> veículo(s) sem motorista vinculado.
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar placa ou modelo" className="pl-9" />
        </div>

        <div className="flex-1 overflow-auto border rounded">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2">Veículo</th>
                  <th className="text-left p-2">Atual</th>
                  <th className="text-left p-2 w-64">Alterar para</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((v) => {
                  const atual = v.motorista_id;
                  const novo = v.id in changes ? changes[v.id] : atual;
                  const mudou = v.id in changes && changes[v.id] !== atual;
                  return (
                    <tr key={v.id} className={`border-t ${mudou ? "bg-primary/5" : ""}`}>
                      <td className="p-2">
                        <p className="font-mono font-bold">{v.placa}</p>
                        <p className="text-xs text-muted-foreground">{v.marca} {v.modelo}</p>
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {atual ? nomePor(atual) : <span className="text-warning">— sem motorista —</span>}
                      </td>
                      <td className="p-2">
                        <Select value={novo ?? "__none__"} onValueChange={(val) => setVal(v.id, val)}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Sem motorista —</SelectItem>
                            {motoristas
                              .filter((m) => !v.empresa_id || !m.empresa_id || m.empresa_id === v.empresa_id)
                              .map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || Object.keys(changes).length === 0}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            💾 Salvar todos ({Object.keys(changes).length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
