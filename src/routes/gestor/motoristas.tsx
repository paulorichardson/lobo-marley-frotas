import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, Plus, Loader2, KeyRound, UserCheck, UserX, Truck, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/gestor/motoristas")({
  head: () => ({ meta: [{ title: "Motoristas — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <MotoristasPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

interface MotoristaRow {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  avatar_url: string | null;
}
interface VeiculoSimples {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  motorista_id: string | null;
}
interface Stats {
  km_mes: number;
  checklists_mes: number;
}

const CATEGORIAS = ["A", "B", "C", "D", "E", "AB"];

function MotoristasPage() {
  const { empresaId } = useAuth();
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [motoristas, setMotoristas] = useState<MotoristaRow[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoSimples[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<MotoristaRow | null>(null);

  async function carregar() {
    if (!empresaId) return;
    setLoading(true);

    // motoristas (perfis com role motorista) na empresa
    const { data: perfis } = await supabase
      .from("perfis")
      .select("id, nome, email, telefone, ativo, avatar_url")
      .eq("empresa_id", empresaId);
    const ids = (perfis ?? []).map((p) => p.id);
    let motoristasIds: string[] = [];
    if (ids.length) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", ids)
        .eq("role", "motorista");
      motoristasIds = (roles ?? []).map((r) => r.user_id);
    }
    const motoristasFinais = (perfis ?? []).filter((p) => motoristasIds.includes(p.id));
    setMotoristas(motoristasFinais);

    // veículos da empresa
    const { data: vs } = await supabase
      .from("veiculos")
      .select("id, placa, marca, modelo, motorista_id")
      .eq("empresa_id", empresaId);
    setVeiculos((vs ?? []) as VeiculoSimples[]);

    // stats do mês (km via abastecimentos km_atual maior que primeiro do mês — aproximação)
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const ini = inicioMes.toISOString();
    const map: Record<string, Stats> = {};
    await Promise.all(motoristasFinais.map(async (m) => {
      const [{ count: cChk }, { data: abs }] = await Promise.all([
        supabase.from("checklists").select("id", { count: "exact", head: true })
          .eq("motorista_id", m.id).gte("data_hora", ini),
        supabase.from("abastecimentos").select("km_atual")
          .eq("motorista_id", m.id).gte("data_hora", ini)
          .order("data_hora", { ascending: true }),
      ]);
      const arr = (abs ?? []).map((a) => Number(a.km_atual || 0)).filter(Boolean);
      const km = arr.length >= 2 ? Math.max(0, arr[arr.length - 1] - arr[0]) : 0;
      map[m.id] = { km_mes: km, checklists_mes: cChk ?? 0 };
    }));
    setStats(map);

    setLoading(false);
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [empresaId]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return motoristas;
    return motoristas.filter((m) =>
      m.nome.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [motoristas, busca]);

  const veicPorMotorista = useMemo(() => {
    const m: Record<string, VeiculoSimples> = {};
    veiculos.forEach((v) => { if (v.motorista_id) m[v.motorista_id] = v; });
    return m;
  }, [veiculos]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-accent" />
          <div>
            <h1 className="text-2xl font-bold">Motoristas</h1>
            <p className="text-sm text-muted-foreground">
              {filtrados.length} de {motoristas.length} motorista(s)
            </p>
          </div>
        </div>
        <Button onClick={() => setNovoOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar motorista
        </Button>
      </header>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9" />
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Card key={i} className="h-48 animate-pulse" />)}
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhum motorista cadastrado.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((m) => {
            const veic = veicPorMotorista[m.id];
            const st = stats[m.id] ?? { km_mes: 0, checklists_mes: 0 };
            return (
              <Card
                key={m.id}
                className="p-4 hover:border-primary/50 transition cursor-pointer"
                onClick={() => setDetalhe(m)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt={m.nome} className="w-full h-full object-cover" />
                      : <Users className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{m.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    <Badge variant={m.ativo ? "default" : "secondary"} className="text-[10px] mt-1">
                      {m.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                    {veic ? (
                      <Badge variant="outline" className="font-mono">{veic.placa}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Sem veículo</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{st.km_mes.toLocaleString("pt-BR")} km</p>
                    <p className="text-[10px] text-muted-foreground">{st.checklists_mes} checklists</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {novoOpen && (
        <NovoMotoristaDialog
          empresaId={empresaId}
          veiculosLivres={veiculos.filter((v) => !v.motorista_id)}
          onClose={() => setNovoOpen(false)}
          onCreated={() => { setNovoOpen(false); carregar(); }}
        />
      )}

      {detalhe && (
        <DetalheMotoristaDialog
          motorista={detalhe}
          veiculo={veicPorMotorista[detalhe.id] ?? null}
          veiculosLivres={veiculos.filter((v) => !v.motorista_id || v.motorista_id === detalhe.id)}
          onClose={() => setDetalhe(null)}
          onChanged={() => { setDetalhe(null); carregar(); }}
        />
      )}
    </div>
  );
}

// =====================================================================
function NovoMotoristaDialog({
  empresaId, veiculosLivres, onClose, onCreated,
}: {
  empresaId: string | null;
  veiculosLivres: VeiculoSimples[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [m, setM] = useState({
    nome: "", email: "", senha: "", telefone: "", whatsapp: "",
    cnh_numero: "", cnh_categoria: "B", cnh_vencimento: "",
    veiculo_id: "" as string,
  });

  function v1() {
    if (!m.nome.trim()) return "Nome obrigatório";
    if (!m.email.includes("@")) return "E-mail inválido";
    if (m.senha.length < 8) return "Senha mínima 8 caracteres";
    return null;
  }

  async function salvar() {
    if (!empresaId) return toast.error("Empresa não identificada");
    const e1 = v1(); if (e1) return toast.error(e1);
    setSaving(true);
    const obs = [
      m.cnh_numero ? `CNH: ${m.cnh_numero} (${m.cnh_categoria})` : null,
      m.cnh_vencimento ? `Venc CNH: ${m.cnh_vencimento}` : null,
      m.whatsapp ? `WhatsApp: ${m.whatsapp}` : null,
    ].filter(Boolean).join(" | ");

    const { data, error } = await supabase.functions.invoke("criar-motorista", {
      body: {
        action: "create",
        empresa_id: empresaId,
        motorista: {
          nome: m.nome.trim(),
          email: m.email.trim().toLowerCase(),
          senha: m.senha,
          telefone: m.telefone || null,
          observacoes: obs,
        },
        vincular_veiculo_id: m.veiculo_id || null,
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      return toast.error(error?.message || (data as any)?.error || "Erro ao criar");
    }
    toast.success("Motorista criado");
    onCreated();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo motorista — etapa {step} de 3</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail *</Label><Input type="email" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} /></div>
              <div><Label>Senha inicial *</Label><Input type="password" value={m.senha} onChange={(e) => setM({ ...m, senha: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={m.telefone} onChange={(e) => setM({ ...m, telefone: e.target.value })} /></div>
              <div><Label>WhatsApp</Label><Input value={m.whatsapp} onChange={(e) => setM({ ...m, whatsapp: e.target.value })} /></div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CNH número</Label><Input value={m.cnh_numero} onChange={(e) => setM({ ...m, cnh_numero: e.target.value })} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={m.cnh_categoria} onValueChange={(v) => setM({ ...m, cnh_categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Vencimento CNH</Label><Input type="date" value={m.cnh_vencimento} onChange={(e) => setM({ ...m, cnh_vencimento: e.target.value })} /></div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>Veículo a vincular (opcional)</Label>
            {veiculosLivres.length === 0 ? (
              <p className="text-sm text-muted-foreground">Não há veículos livres na empresa.</p>
            ) : (
              <Select value={m.veiculo_id} onValueChange={(v) => setM({ ...m, veiculo_id: v })}>
                <SelectTrigger><SelectValue placeholder="— sem vínculo —" /></SelectTrigger>
                <SelectContent>
                  {veiculosLivres.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.placa} • {v.marca} {v.modelo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 mt-4">
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Voltar</Button>}
          {step < 3 && <Button onClick={() => {
            if (step === 1) { const e = v1(); if (e) return toast.error(e); }
            setStep(step + 1);
          }}>Próximo</Button>}
          {step === 3 && (
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Criar motorista
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================================
function DetalheMotoristaDialog({
  motorista, veiculo, veiculosLivres, onClose, onChanged,
}: {
  motorista: MotoristaRow;
  veiculo: VeiculoSimples | null;
  veiculosLivres: VeiculoSimples[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [novaSenha, setNovaSenha] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [trocaVeic, setTrocaVeic] = useState<string>("");
  const [historico, setHistorico] = useState<{
    checklists: any[]; viagens: any[]; abastecimentos: any[];
  }>({ checklists: [], viagens: [], abastecimentos: [] });

  useEffect(() => {
    (async () => {
      const [c, v, a] = await Promise.all([
        supabase.from("checklists").select("id, data_hora, status, tipo")
          .eq("motorista_id", motorista.id).order("data_hora", { ascending: false }).limit(5),
        supabase.from("viagens").select("id, data_saida, destino, km_percorrido")
          .eq("motorista_id", motorista.id).order("data_saida", { ascending: false }).limit(5),
        supabase.from("abastecimentos").select("id, data_hora, valor_total, litros")
          .eq("motorista_id", motorista.id).order("data_hora", { ascending: false }).limit(5),
      ]);
      setHistorico({
        checklists: c.data ?? [],
        viagens: v.data ?? [],
        abastecimentos: a.data ?? [],
      });
    })();
  }, [motorista.id]);

  async function resetSenha() {
    if (novaSenha.length < 8) return toast.error("Mínimo 8 caracteres");
    const { data, error } = await supabase.functions.invoke("criar-motorista", {
      body: { action: "reset_password", motorista_id: motorista.id, nova_senha: novaSenha },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message);
    toast.success("Senha redefinida");
    setResetOpen(false); setNovaSenha("");
  }

  async function toggleAtivo() {
    const { data, error } = await supabase.functions.invoke("criar-motorista", {
      body: { action: "toggle_ativo", motorista_id: motorista.id, ativo: !motorista.ativo },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message);
    toast.success(motorista.ativo ? "Motorista desativado" : "Motorista reativado");
    onChanged();
  }

  async function trocarVeiculo() {
    if (!trocaVeic) return;
    const { data, error } = await supabase.functions.invoke("criar-motorista", {
      body: { action: "vincular_veiculo", motorista_id: motorista.id, veiculo_id: trocaVeic },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message);
    toast.success("Veículo vinculado");
    onChanged();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{motorista.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><Label className="text-xs">E-mail</Label><p>{motorista.email}</p></div>
            <div><Label className="text-xs">Telefone</Label><p>{motorista.telefone || "—"}</p></div>
            <div>
              <Label className="text-xs">Status</Label>
              <p><Badge variant={motorista.ativo ? "default" : "secondary"}>
                {motorista.ativo ? "Ativo" : "Inativo"}</Badge></p>
            </div>
            <div>
              <Label className="text-xs">Veículo atual</Label>
              <p>{veiculo ? `${veiculo.placa} • ${veiculo.marca} ${veiculo.modelo}` : "—"}</p>
            </div>
          </div>

          <Card className="p-3 space-y-2">
            <Label>Trocar / vincular veículo</Label>
            <div className="flex gap-2">
              <Select value={trocaVeic} onValueChange={setTrocaVeic}>
                <SelectTrigger><SelectValue placeholder="Escolher veículo" /></SelectTrigger>
                <SelectContent>
                  {veiculosLivres.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.placa} • {v.marca} {v.modelo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={trocarVeiculo} disabled={!trocaVeic}>Aplicar</Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-3">
              <p className="text-xs uppercase text-muted-foreground mb-1">Últimos checklists</p>
              {historico.checklists.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum</p>
              ) : historico.checklists.map((c) => (
                <p key={c.id} className="text-xs truncate">
                  {new Date(c.data_hora).toLocaleDateString("pt-BR")} • {c.status}
                </p>
              ))}
            </Card>
            <Card className="p-3">
              <p className="text-xs uppercase text-muted-foreground mb-1">Últimas viagens</p>
              {historico.viagens.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma</p>
              ) : historico.viagens.map((v) => (
                <p key={v.id} className="text-xs truncate">
                  {new Date(v.data_saida).toLocaleDateString("pt-BR")} • {v.km_percorrido ?? 0} km
                </p>
              ))}
            </Card>
            <Card className="p-3">
              <p className="text-xs uppercase text-muted-foreground mb-1">Últimos abastecimentos</p>
              {historico.abastecimentos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum</p>
              ) : historico.abastecimentos.map((a) => (
                <p key={a.id} className="text-xs truncate">
                  {new Date(a.data_hora).toLocaleDateString("pt-BR")} • R$ {Number(a.valor_total ?? 0).toFixed(2)}
                </p>
              ))}
            </Card>
          </div>

          {!resetOpen ? (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setResetOpen(true)}>
                <KeyRound className="w-4 h-4 mr-1" /> Redefinir senha
              </Button>
              <Button variant={motorista.ativo ? "destructive" : "default"} onClick={toggleAtivo}>
                {motorista.ativo ? <UserX className="w-4 h-4 mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}
                {motorista.ativo ? "Desativar" : "Reativar"}
              </Button>
            </div>
          ) : (
            <Card className="p-3 space-y-2">
              <Label>Nova senha (mínimo 8 caracteres)</Label>
              <div className="flex gap-2">
                <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
                <Button onClick={resetSenha}>Salvar</Button>
                <Button variant="ghost" onClick={() => { setResetOpen(false); setNovaSenha(""); }}>Cancelar</Button>
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
