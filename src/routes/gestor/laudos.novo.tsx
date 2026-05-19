import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraInput } from "@/components/CameraInput";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { uploadFile, uploadDataUrl } from "@/lib/upload";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, FileText, Loader2, ClipboardCheck } from "lucide-react";
import { imprimirLaudo } from "@/lib/laudo-pdf";

export const Route = createFileRoute("/gestor/laudos/novo")({
  head: () => ({ meta: [{ title: "Novo Laudo de Vistoria — Lobo Marley" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ veiculo: (s.veiculo as string) || undefined }) as { veiculo?: string },
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <NovoLaudo />
      </AppShell>
    </ProtectedRoute>
  ),
});

const CHECKLIST_ITENS = [
  "Pneus (dianteiros)", "Pneus (traseiros)", "Estepe", "Macaco/chave de roda",
  "Freios", "Faróis", "Luzes de freio", "Setas", "Limpadores",
  "Buzina", "Cinto de segurança", "Triângulo/extintor",
  "Bateria", "Nível de óleo", "Nível de água", "Combustível",
  "CRLV no veículo", "Documentos do condutor", "Lataria geral",
  "Vidros", "Bancos", "Painel/multimídia",
];

const LADOS = ["Frontal", "Traseira", "Lateral Esquerda", "Lateral Direita", "Teto", "Capô", "Porta-malas", "Interior"];
const TIPOS_AVARIA = ["Risco", "Amassado", "Trinca", "Faltante", "Quebrado", "Manchado", "Desgaste"];
const SEVERIDADES = ["Leve", "Moderada", "Grave"];

type Estado = "ok" | "atencao" | "problema" | "na";
const ESTADOS: { v: Estado; label: string; cls: string }[] = [
  { v: "ok", label: "OK", cls: "bg-green-600" },
  { v: "atencao", label: "Atenção", cls: "bg-yellow-500" },
  { v: "problema", label: "Problema", cls: "bg-red-600" },
  { v: "na", label: "N/A", cls: "bg-gray-400" },
];

const SLOTS_FOTO = ["Frente", "Traseira", "Lateral Esq.", "Lateral Dir.", "Painel/Odômetro", "Interior", "Outro"];

function NovoLaudo() {
  const { user, empresaId } = useAuth();
  const navigate = useNavigate();
  const { veiculo: veiculoIdSearch } = Route.useSearch();

  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [veiculoId, setVeiculoId] = useState<string>(veiculoIdSearch || "");
  const [veiculo, setVeiculo] = useState<any | null>(null);

  const [tipo, setTipo] = useState("periodica");
  const [km, setKm] = useState("");
  const [local, setLocal] = useState("");
  const [respNome, setRespNome] = useState("");
  const [respDoc, setRespDoc] = useState("");
  const [obs, setObs] = useState("");

  const [checklist, setChecklist] = useState<Record<string, Estado>>(
    Object.fromEntries(CHECKLIST_ITENS.map((i) => [i, "ok" as Estado])),
  );

  const [avarias, setAvarias] = useState<Array<{ lado: string; tipo: string; severidade: string; descricao: string }>>([]);

  const [fotos, setFotos] = useState<Array<{ slot: string; file: File | null }>>(
    SLOTS_FOTO.map((s) => ({ slot: s, file: null })),
  );

  const sigVistRef = useRef<SignaturePadHandle>(null);
  const sigRespRef = useRef<SignaturePadHandle>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    supabase
      .from("veiculos")
      .select("id, placa, marca, modelo, cor, chassi, renavam, km_atual")
      .eq("empresa_id", empresaId)
      .order("placa")
      .then(({ data }) => setVeiculos(data ?? []));
  }, [empresaId]);

  useEffect(() => {
    if (!veiculoId) { setVeiculo(null); return; }
    const v = veiculos.find((x) => x.id === veiculoId);
    if (v) { setVeiculo(v); if (!km) setKm(String(v.km_atual ?? "")); }
  }, [veiculoId, veiculos]);

  function setEstado(item: string, v: Estado) {
    setChecklist((p) => ({ ...p, [item]: v }));
  }

  function addAvaria() {
    setAvarias((p) => [...p, { lado: LADOS[0], tipo: TIPOS_AVARIA[0], severidade: "Leve", descricao: "" }]);
  }
  function removeAvaria(i: number) { setAvarias((p) => p.filter((_, idx) => idx !== i)); }
  function updateAvaria(i: number, patch: Partial<{ lado: string; tipo: string; severidade: string; descricao: string }>) {
    setAvarias((p) => p.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function setFoto(slot: string, file: File | null) {
    setFotos((p) => p.map((f) => (f.slot === slot ? { ...f, file } : f)));
  }

  const resumoChecklist = useMemo(() => {
    const c = { ok: 0, atencao: 0, problema: 0, na: 0 };
    Object.values(checklist).forEach((v) => { c[v] += 1; });
    return c;
  }, [checklist]);

  async function salvar(imprimirAposSalvar: boolean) {
    if (!user || !empresaId) return toast.error("Sessão inválida");
    if (!veiculoId) return toast.error("Selecione um veículo");
    if (!km) return toast.error("Informe o KM");
    if (sigVistRef.current?.isEmpty()) return toast.error("Assinatura do vistoriador é obrigatória");

    setSaving(true);
    try {
      const prefix = `${empresaId}/${veiculoId}/${Date.now()}`;

      const fotosUp: Array<{ slot: string; path: string; legenda: string }> = [];
      for (const f of fotos) {
        if (!f.file) continue;
        const path = await uploadFile("laudos-fotos", `${prefix}/fotos`, f.file, "jpg");
        fotosUp.push({ slot: f.slot, path, legenda: f.slot });
      }

      const sigVist = await uploadDataUrl("laudos-fotos", `${prefix}/sig`, sigVistRef.current!.toDataURL());
      const sigResp = sigRespRef.current && !sigRespRef.current.isEmpty()
        ? await uploadDataUrl("laudos-fotos", `${prefix}/sig`, sigRespRef.current.toDataURL())
        : null;

      const { data: laudo, error } = await supabase
        .from("laudos_vistoria")
        .insert({
          empresa_id: empresaId,
          veiculo_id: veiculoId,
          vistoriador_id: user.id,
          tipo,
          km_registrado: Number(km),
          local_vistoria: local || null,
          responsavel_nome: respNome || null,
          responsavel_documento: respDoc || null,
          checklist,
          avarias,
          fotos: fotosUp,
          observacoes: obs || null,
          assinatura_vistoriador_path: sigVist,
          assinatura_responsavel_path: sigResp,
          status: "concluido",
        })
        .select("id")
        .single();
      if (error) throw error;

      toast.success("Laudo registrado com sucesso");

      if (imprimirAposSalvar) {
        await gerarPDF(laudo!.id, fotosUp, sigVist, sigResp);
      } else {
        navigate({ to: "/gestor/laudos" });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao salvar laudo");
    } finally {
      setSaving(false);
    }
  }

  async function gerarPDF(
    laudoId: string,
    fotosUp: Array<{ slot: string; path: string; legenda: string }>,
    sigVist: string,
    sigResp: string | null,
  ) {
    if (!veiculo) return;
    const url = (path: string) =>
      supabase.storage.from("laudos-fotos").createSignedUrl(path, 3600).then((r) => r.data?.signedUrl ?? "");

    const [fotosUrls, sigVistUrl, sigRespUrl] = await Promise.all([
      Promise.all(fotosUp.map(async (f) => ({ legenda: f.legenda, url: await url(f.path) }))),
      url(sigVist),
      sigResp ? url(sigResp) : Promise.resolve(""),
    ]);

    let empresaNome: string | null = null;
    if (empresaId) {
      const { data } = await supabase.from("empresas").select("razao_social, nome_fantasia").eq("id", empresaId).maybeSingle();
      empresaNome = data?.nome_fantasia || data?.razao_social || null;
    }

    imprimirLaudo({
      numero: laudoId.slice(0, 8).toUpperCase(),
      tipo,
      data: new Date().toISOString(),
      local,
      km: Number(km),
      empresa_nome: empresaNome,
      vistoriador_nome: user?.user_metadata?.nome || user?.email,
      responsavel_nome: respNome,
      responsavel_documento: respDoc,
      veiculo: {
        placa: veiculo.placa,
        marca: veiculo.marca,
        modelo: veiculo.modelo,
        cor: veiculo.cor,
        chassi: veiculo.chassi,
        renavam: veiculo.renavam,
      },
      checklist,
      avarias,
      fotos: fotosUrls.filter((f) => f.url),
      observacoes: obs,
      assinatura_vistoriador_url: sigVistUrl,
      assinatura_responsavel_url: sigRespUrl || null,
    });

    navigate({ to: "/gestor/laudos" });
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/gestor/laudos"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Link>
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" /> Novo Laudo de Vistoria
        </h1>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Veículo *</Label>
            <Select value={veiculoId} onValueChange={setVeiculoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
              <SelectContent>
                {veiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de vistoria</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="periodica">Periódica</SelectItem>
                <SelectItem value="entrega">Entrega ao motorista</SelectItem>
                <SelectItem value="devolucao">Devolução do motorista</SelectItem>
                <SelectItem value="sinistro">Sinistro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>KM atual *</Label>
            <Input type="number" value={km} onChange={(e) => setKm(e.target.value)} />
          </div>
          <div>
            <Label>Local da vistoria</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: Garagem central" />
          </div>
          <div>
            <Label>Responsável presente</Label>
            <Input value={respNome} onChange={(e) => setRespNome(e.target.value)} placeholder="Nome" />
          </div>
          <div>
            <Label>Documento (CPF/RG)</Label>
            <Input value={respDoc} onChange={(e) => setRespDoc(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold">Checklist ({CHECKLIST_ITENS.length} itens)</h2>
          <div className="flex gap-2 text-xs">
            <Badge className="bg-green-600">OK {resumoChecklist.ok}</Badge>
            <Badge className="bg-yellow-500">! {resumoChecklist.atencao}</Badge>
            <Badge className="bg-red-600">✗ {resumoChecklist.problema}</Badge>
            <Badge className="bg-gray-400">— {resumoChecklist.na}</Badge>
          </div>
        </div>
        <div className="space-y-1">
          {CHECKLIST_ITENS.map((item) => (
            <div key={item} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
              <span className="text-sm flex-1">{item}</span>
              <div className="flex gap-1">
                {ESTADOS.map((e) => (
                  <button
                    key={e.v}
                    type="button"
                    onClick={() => setEstado(item, e.v)}
                    className={`px-2 py-1 rounded text-xs font-bold text-white transition-opacity ${e.cls} ${
                      checklist[item] === e.v ? "opacity-100 ring-2 ring-offset-1 ring-foreground" : "opacity-40"
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Avarias registradas ({avarias.length})</h2>
          <Button type="button" size="sm" onClick={addAvaria}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
        </div>
        {avarias.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma avaria registrada.</p>}
        {avarias.map((a, i) => (
          <div key={i} className="grid md:grid-cols-12 gap-2 items-start border rounded-md p-2 bg-muted/30">
            <div className="md:col-span-3">
              <Label className="text-xs">Lado</Label>
              <Select value={a.lado} onValueChange={(v) => updateAvaria(i, { lado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LADOS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Tipo</Label>
              <Select value={a.tipo} onValueChange={(v) => updateAvaria(i, { tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_AVARIA.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Severidade</Label>
              <Select value={a.severidade} onValueChange={(v) => updateAvaria(i, { severidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERIDADES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Descrição</Label>
              <Input value={a.descricao} onChange={(e) => updateAvaria(i, { descricao: e.target.value })} placeholder="Detalhe..." />
            </div>
            <div className="md:col-span-1 flex md:items-end">
              <Button type="button" variant="ghost" size="icon" onClick={() => removeAvaria(i)} className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Fotos da vistoria</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {fotos.map((f) => (
            <div key={f.slot}>
              <Label className="text-xs font-medium">{f.slot}</Label>
              <CameraInput label={`Tirar foto: ${f.slot}`} onChange={(file) => setFoto(f.slot, file)} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Observações</h2>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Anotações gerais..." />
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-4 space-y-2">
          <Label className="font-semibold">Assinatura do vistoriador *</Label>
          <SignaturePad ref={sigVistRef} />
        </Card>
        <Card className="p-4 space-y-2">
          <Label className="font-semibold">Assinatura do responsável</Label>
          <SignaturePad ref={sigRespRef} />
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sticky bottom-2">
        <Button variant="outline" className="flex-1" onClick={() => salvar(false)} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar laudo
        </Button>
        <Button className="flex-1" onClick={() => salvar(true)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
          Salvar e gerar PDF
        </Button>
      </div>
    </div>
  );
}
