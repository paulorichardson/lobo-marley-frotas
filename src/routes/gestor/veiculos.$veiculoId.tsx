import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Trash2, Upload, ClipboardCheck, Fuel, Wrench, Receipt, FileText, AlertTriangle, X } from "lucide-react";
import { statusBadgeVariant, vencendoEmBreve, TIPOS_FOTO } from "@/lib/veiculo-constants";
import { StorageImage } from "@/components/veiculos/StorageImage";
import { VeiculoForm, type VeiculoFormValues } from "@/components/veiculos/VeiculoForm";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gestor/veiculos/$veiculoId")({
  head: () => ({ meta: [{ title: "Detalhe do veículo — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <DetalheVeiculo />
      </AppShell>
    </ProtectedRoute>
  ),
});

function DetalheVeiculo() {
  const { veiculoId } = Route.useParams();
  const navigate = useNavigate();
  const [veiculo, setVeiculo] = useState<any | null>(null);
  const [motoristaNome, setMotoristaNome] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("dados");

  async function carregar() {
    const { data } = await supabase.from("veiculos").select("*").eq("id", veiculoId).maybeSingle();
    setVeiculo(data);
    if (data?.motorista_id) {
      const { data: p } = await supabase.from("perfis").select("nome").eq("id", data.motorista_id).maybeSingle();
      setMotoristaNome(p?.nome || "");
    } else {
      setMotoristaNome("");
    }
  }

  useEffect(() => { carregar(); }, [veiculoId]);

  if (!veiculo) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }

  const badge = statusBadgeVariant(veiculo.status);

  if (editing) {
    const initial: Partial<VeiculoFormValues> = {
      id: veiculo.id,
      placa: veiculo.placa,
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      ano_fabricacao: veiculo.ano_fabricacao?.toString() || "",
      ano_modelo: veiculo.ano_modelo?.toString() || "",
      cor: veiculo.cor || "",
      combustivel: veiculo.combustivel || "Flex",
      categoria: veiculo.categoria || "Carro",
      chassi: veiculo.chassi || "",
      renavam: veiculo.renavam || "",
      km_atual: veiculo.km_atual?.toString() || "0",
      km_proxima_revisao: veiculo.km_proxima_revisao?.toString() || "",
      status: veiculo.status,
      vencimento_licenciamento: veiculo.vencimento_licenciamento || "",
      vencimento_ipva: veiculo.vencimento_ipva || "",
      vencimento_seguro: veiculo.vencimento_seguro || "",
      motorista_id: veiculo.motorista_id || "",
      foto_principal_url: veiculo.foto_principal_url || "",
      doc_crlv_url: veiculo.doc_crlv_url || "",
      doc_seguro_url: veiculo.doc_seguro_url || "",
    };
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => setEditing(false)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <VeiculoForm initial={initial} onSaved={() => { setEditing(false); carregar(); }} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/gestor/veiculos"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Link>
        </Button>
        <Button onClick={() => setEditing(true)}><Edit className="w-4 h-4 mr-2" />Editar</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[280px_1fr] gap-0">
          <StorageImage
            bucket="veiculos-fotos"
            path={veiculo.foto_principal_url}
            alt={`${veiculo.marca} ${veiculo.modelo}`}
            className="w-full h-48 md:h-full object-cover bg-muted"
          />
          <div className="p-5 space-y-2">
            <p className="text-3xl md:text-4xl font-mono font-bold tracking-wider">{formatPlaca(veiculo.placa)}</p>
            <p className="text-lg">{veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo && `· ${veiculo.ano_modelo}`}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={cn("text-xs", badge.className)}>{badge.label}</Badge>
              {veiculo.categoria && <Badge variant="outline" className="text-xs">{veiculo.categoria}</Badge>}
              {veiculo.combustivel && <Badge variant="outline" className="text-xs">{veiculo.combustivel}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground pt-2">
              {Number(veiculo.km_atual).toLocaleString("pt-BR")} km · Motorista: {motoristaNome || "—"}
            </p>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="hist">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <DadosTab veiculo={veiculo} motoristaNome={motoristaNome} />
        </TabsContent>
        <TabsContent value="fotos" className="mt-4">
          <FotosTab veiculoId={veiculo.id} placa={veiculo.placa} />
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <DocsTab veiculo={veiculo} onChanged={carregar} />
        </TabsContent>
        <TabsContent value="hist" className="mt-4">
          <HistoricoTab veiculoId={veiculo.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatPlaca(p: string) {
  if (!p || p.length < 4) return p;
  return `${p.slice(0, 3)}-${p.slice(3)}`;
}

function DadosTab({ veiculo, motoristaNome }: { veiculo: any; motoristaNome: string }) {
  return (
    <Card className="p-5 grid md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <Field label="Placa" value={formatPlaca(veiculo.placa)} />
      <Field label="Marca / Modelo" value={`${veiculo.marca} ${veiculo.modelo}`} />
      <Field label="Ano fabricação" value={veiculo.ano_fabricacao} />
      <Field label="Ano modelo" value={veiculo.ano_modelo} />
      <Field label="Cor" value={veiculo.cor} />
      <Field label="Combustível" value={veiculo.combustivel} />
      <Field label="Categoria" value={veiculo.categoria} />
      <Field label="Status" value={veiculo.status} />
      <Field label="Chassi" value={veiculo.chassi} />
      <Field label="Renavam" value={veiculo.renavam} />
      <Field label="KM atual" value={veiculo.km_atual ? Number(veiculo.km_atual).toLocaleString("pt-BR") : "—"} />
      <Field label="KM próxima revisão" value={veiculo.km_proxima_revisao ? Number(veiculo.km_proxima_revisao).toLocaleString("pt-BR") : "—"} />
      <Field label="Motorista" value={motoristaNome || "—"} />
      <DateField label="Vencimento Licenciamento" value={veiculo.vencimento_licenciamento} />
      <DateField label="Vencimento IPVA" value={veiculo.vencimento_ipva} />
      <DateField label="Vencimento Seguro" value={veiculo.vencimento_seguro} />
    </Card>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function DateField({ label, value }: { label: string; value: string | null }) {
  const alerta = vencendoEmBreve(value);
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn("font-medium flex items-center gap-2", alerta && "text-destructive")}>
        {value ? new Date(value).toLocaleDateString("pt-BR") : "—"}
        {alerta && <AlertTriangle className="w-3.5 h-3.5" />}
      </p>
    </div>
  );
}

function FotosTab({ veiculoId, placa }: { veiculoId: string; placa: string }) {
  const { user } = useAuth();
  const [fotos, setFotos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from("veiculo_fotos")
      .select("*")
      .eq("veiculo_id", veiculoId)
      .order("criado_em", { ascending: false });
    setFotos(data ?? []);
  }
  useEffect(() => { carregar(); }, [veiculoId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) return;
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${placa}/galeria/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("veiculos-fotos").upload(path, f);
        if (error) throw error;
        await supabase.from("veiculo_fotos").insert({
          veiculo_id: veiculoId,
          url: path,
          tipo: "geral",
          enviado_por: user.id,
        });
      }
      toast.success("Fotos enviadas");
      carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar fotos");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function remover(id: string, path: string) {
    if (!confirm("Remover esta foto?")) return;
    await supabase.storage.from("veiculos-fotos").remove([path]);
    await supabase.from("veiculo_fotos").delete().eq("id", id);
    toast.success("Foto removida");
    carregar();
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{fotos.length} foto(s)</p>
        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-accent/10 text-sm">
          <Upload className="w-4 h-4" /> {uploading ? "Enviando..." : "Adicionar"}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {fotos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma foto.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {fotos.map((f) => (
            <div key={f.id} className="relative group rounded-lg overflow-hidden border border-border">
              <StorageImage bucket="veiculos-fotos" path={f.url} className="w-full h-32 object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur px-2 py-1 text-xs">
                {TIPOS_FOTO.find((t) => t.value === f.tipo)?.label || f.tipo}
              </div>
              <button
                onClick={() => remover(f.id, f.url)}
                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DocsTab({ veiculo, onChanged }: { veiculo: any; onChanged: () => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <DocCard
        label="CRLV"
        path={veiculo.doc_crlv_url}
        vencimento={veiculo.vencimento_licenciamento}
        veiculoId={veiculo.id}
        placa={veiculo.placa}
        column="doc_crlv_url"
        subdir="crlv"
        onChanged={onChanged}
      />
      <DocCard
        label="Apólice de seguro"
        path={veiculo.doc_seguro_url}
        vencimento={veiculo.vencimento_seguro}
        veiculoId={veiculo.id}
        placa={veiculo.placa}
        column="doc_seguro_url"
        subdir="seguro"
        onChanged={onChanged}
      />
    </div>
  );
}

function DocCard({ label, path, vencimento, veiculoId, placa, column, subdir, onChanged }: {
  label: string; path: string | null; vencimento: string | null; veiculoId: string; placa: string;
  column: string; subdir: string; onChanged: () => void;
}) {
  const url = useSignedUrl("veiculos-docs", path);
  const alerta = vencendoEmBreve(vencimento);

  async function substituir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop() || "bin";
    const newPath = `${placa}/${subdir}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("veiculos-docs").upload(newPath, f);
    if (error) { toast.error(error.message); return; }
    if (path) await supabase.storage.from("veiculos-docs").remove([path]);
    await supabase.from("veiculos").update({ [column]: newPath }).eq("id", veiculoId);
    toast.success("Documento atualizado");
    onChanged();
    e.target.value = "";
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />{label}</h4>
        <label className="cursor-pointer text-sm text-accent hover:underline">
          {path ? "Substituir" : "Enviar"}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={substituir} />
        </label>
      </div>
      {vencimento && (
        <p className={cn("text-sm", alerta && "text-destructive")}>
          Vence em: <strong>{new Date(vencimento).toLocaleDateString("pt-BR")}</strong>
          {alerta && " — atenção!"}
        </p>
      )}
      {path && url ? (
        url.includes(".pdf") || path.endsWith(".pdf") ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block p-4 border border-border rounded text-center text-sm hover:bg-accent/10">
            Abrir PDF
          </a>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <img src={url} alt={label} className="w-full max-h-60 object-contain rounded border border-border" />
          </a>
        )
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum arquivo enviado.</p>
      )}
    </Card>
  );
}

interface HistItem {
  id: string;
  tipo: "checklist" | "abastecimento" | "manutencao" | "despesa";
  data: string;
  titulo: string;
  detalhe: string;
  valor?: number;
}

function HistoricoTab({ veiculoId }: { veiculoId: string }) {
  const [items, setItems] = useState<HistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [chk, abs, man, des] = await Promise.all([
        supabase.from("checklists").select("id, data_hora, tipo, status, km_registrado").eq("veiculo_id", veiculoId),
        supabase.from("abastecimentos").select("id, data_hora, litros, valor_total, posto").eq("veiculo_id", veiculoId),
        supabase.from("manutencoes").select("id, data_solicitacao, tipo, descricao, valor_final, status").eq("veiculo_id", veiculoId),
        supabase.from("despesas").select("id, data_despesa, tipo, descricao, valor").eq("veiculo_id", veiculoId),
      ]);
      const all: HistItem[] = [
        ...(chk.data ?? []).map((c: any): HistItem => ({
          id: `c${c.id}`, tipo: "checklist", data: c.data_hora,
          titulo: `Checklist ${c.tipo}`, detalhe: `Status: ${c.status}${c.km_registrado ? ` · ${c.km_registrado} km` : ""}`,
        })),
        ...(abs.data ?? []).map((a: any): HistItem => ({
          id: `a${a.id}`, tipo: "abastecimento", data: a.data_hora,
          titulo: "Abastecimento", detalhe: `${a.litros}L · ${a.posto || "Posto"}`,
          valor: a.valor_total,
        })),
        ...(man.data ?? []).map((m: any): HistItem => ({
          id: `m${m.id}`, tipo: "manutencao", data: m.data_solicitacao,
          titulo: `Manutenção: ${m.tipo}`, detalhe: `${m.descricao} · ${m.status}`,
          valor: m.valor_final,
        })),
        ...(des.data ?? []).map((d: any): HistItem => ({
          id: `d${d.id}`, tipo: "despesa", data: d.data_despesa,
          titulo: `Despesa: ${d.tipo}`, detalhe: d.descricao || "",
          valor: d.valor,
        })),
      ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setItems(all);
      setLoading(false);
    })();
  }, [veiculoId]);

  const ICON: Record<string, any> = {
    checklist: ClipboardCheck, abastecimento: Fuel, manutencao: Wrench, despesa: Receipt,
  };

  if (loading) return <Card className="p-8 text-center text-muted-foreground">Carregando...</Card>;
  if (items.length === 0) return <Card className="p-8 text-center text-muted-foreground">Sem histórico.</Card>;

  return (
    <Card className="divide-y divide-border">
      {items.map((it) => {
        const Icon = ICON[it.tipo];
        return (
          <div key={it.id} className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{it.titulo}</p>
              <p className="text-xs text-muted-foreground truncate">{it.detalhe}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">{new Date(it.data).toLocaleDateString("pt-BR")}</p>
              {it.valor != null && (
                <p className="text-sm font-semibold">R$ {Number(it.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
