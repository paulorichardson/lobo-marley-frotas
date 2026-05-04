import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, AlertCircle, User as UserIcon } from "lucide-react";
import { CATEGORIAS, STATUS_VEICULO, statusBadgeVariant, veiculoTemAlerta } from "@/lib/veiculo-constants";
import { StorageImage } from "@/components/veiculos/StorageImage";
import { VeiculoForm } from "@/components/veiculos/VeiculoForm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gestor/veiculos")({
  head: () => ({ meta: [{ title: "Veículos — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <ListaVeiculos />
      </AppShell>
    </ProtectedRoute>
  ),
});

interface VeiculoRow {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  status: string;
  categoria: string | null;
  km_atual: number;
  motorista_id: string | null;
  foto_principal_url: string | null;
  vencimento_licenciamento: string | null;
  vencimento_ipva: string | null;
  vencimento_seguro: string | null;
  setor: string | null;
}

function ListaVeiculos() {
  const navigate = useNavigate();
  const [veiculos, setVeiculos] = useState<VeiculoRow[]>([]);
  const [motoristas, setMotoristas] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [catFiltro, setCatFiltro] = useState<string>("todas");
  const [setorFiltro, setSetorFiltro] = useState<string>("todos");
  const [loading, setLoading] = useState(true);
  const [novoOpen, setNovoOpen] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from("veiculos")
      .select("id, placa, marca, modelo, status, categoria, km_atual, motorista_id, foto_principal_url, vencimento_licenciamento, vencimento_ipva, vencimento_seguro, setor")
      .order("criado_em", { ascending: false });
    setVeiculos((data ?? []) as VeiculoRow[]);
    const ids = Array.from(new Set((data ?? []).map((v) => v.motorista_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: perfis } = await supabase.from("perfis").select("id, nome").in("id", ids);
      const map: Record<string, string> = {};
      (perfis ?? []).forEach((p) => { map[p.id] = p.nome; });
      setMotoristas(map);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const setoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    veiculos.forEach((v) => { if (v.setor) set.add(v.setor); });
    return Array.from(set).sort();
  }, [veiculos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return veiculos.filter((v) => {
      if (statusFiltro !== "todos" && v.status !== statusFiltro) return false;
      if (catFiltro !== "todas" && v.categoria !== catFiltro) return false;
      if (setorFiltro !== "todos" && v.setor !== setorFiltro) return false;
      if (q && !`${v.placa} ${v.marca} ${v.modelo}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [veiculos, busca, statusFiltro, catFiltro, setorFiltro]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Veículos</h1>
          <p className="text-sm text-muted-foreground">{filtrados.length} de {veiculos.length} veículo(s)</p>
        </div>
        <Button onClick={() => setNovoOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo veículo
        </Button>
      </header>

      <Card className="p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por placa ou modelo" className="pl-9" />
        </div>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_VEICULO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={catFiltro} onValueChange={setCatFiltro}>
          <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {setoresDisponiveis.length > 0 && (
          <Select value={setorFiltro} onValueChange={setSetorFiltro}>
            <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos setores</SelectItem>
              {setoresDisponiveis.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Card key={i} className="h-64 animate-pulse" />)}
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Nenhum veículo encontrado.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((v) => {
            const badge = statusBadgeVariant(v.status);
            const alerta = veiculoTemAlerta(v);
            return (
              <Link
                key={v.id}
                to="/gestor/veiculos/$veiculoId"
                params={{ veiculoId: v.id }}
                className="block group"
              >
                <Card className="overflow-hidden hover:border-primary/50 transition-colors">
                  <StorageImage
                    bucket="veiculos-fotos"
                    path={v.foto_principal_url}
                    alt={`${v.marca} ${v.modelo}`}
                    className="w-full h-40 object-cover bg-muted"
                  />
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-2xl font-mono font-bold tracking-wider">{formatPlaca(v.placa)}</p>
                      {alerta && (
                        <span title="Documento vencendo">
                          <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{v.marca} {v.modelo}</p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Badge variant="outline" className={cn("text-xs", badge.className)}>{badge.label}</Badge>
                      <span className="text-xs text-muted-foreground">{Number(v.km_atual).toLocaleString("pt-BR")} km</span>
                    </div>
                    {v.setor && (
                      <Badge variant="secondary" className="text-xs">🏛️ {v.setor}</Badge>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
                      <UserIcon className="w-3 h-3" />
                      <span className="truncate">{v.motorista_id ? motoristas[v.motorista_id] || "Motorista" : "Sem motorista"}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo veículo</DialogTitle></DialogHeader>
          <VeiculoForm
            onSaved={(id) => {
              setNovoOpen(false);
              carregar();
              navigate({ to: "/gestor/veiculos/$veiculoId", params: { veiculoId: id } });
            }}
            onCancel={() => setNovoOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatPlaca(p: string) {
  if (!p || p.length < 4) return p;
  return `${p.slice(0, 3)}-${p.slice(3)}`;
}
