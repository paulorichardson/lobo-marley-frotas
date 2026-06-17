import { useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, Sparkles, FileText, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Parsed = {
  numero_nf?: string | null;
  serie_nf?: string | null;
  data_emissao?: string | null;
  fornecedor?: { cnpj?: string | null; razao_social?: string | null; nome_fantasia?: string | null };
  valor_total?: number | null;
  valor_servicos?: number | null;
  valor_pecas?: number | null;
  descricao?: string | null;
  placa_veiculo?: string | null;
  tipo_servico?: string | null;
  itens?: any[];
};

type Item = {
  id: string;
  filename: string;
  fileBase64: string;
  mime: string;
  status: "pendente" | "processando" | "ok" | "erro" | "salvando" | "salvo";
  error?: string;
  data?: Parsed;
  // resolução
  fornecedorId?: string | null;
  veiculoId?: string | null;
  veiculoPlaca?: string | null;
};

const TIPOS = ["Preventiva", "Corretiva", "Pneu", "Elétrica", "Funilaria", "Revisão", "Outro"];

function digitsOnly(s?: string | null) {
  return (s ?? "").replace(/\D/g, "");
}

async function fileToBase64(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function EnviarNotasFiscaisModal({
  open, onOpenChange, empresaId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const novos: Item[] = [];
    for (const f of Array.from(files)) {
      const name = f.name.toLowerCase();
      if (name.endsWith(".zip")) {
        try {
          const zip = await JSZip.loadAsync(f);
          for (const entry of Object.values(zip.files)) {
            if (entry.dir) continue;
            const eName = entry.name.toLowerCase();
            if (!eName.endsWith(".pdf")) continue;
            const blob = await entry.async("blob");
            novos.push({
              id: crypto.randomUUID(),
              filename: entry.name.split("/").pop() || entry.name,
              fileBase64: await fileToBase64(blob),
              mime: "application/pdf",
              status: "pendente",
            });
          }
        } catch (e: any) {
          toast.error(`Erro ao abrir ZIP ${f.name}: ${e.message}`);
        }
      } else if (name.endsWith(".pdf")) {
        novos.push({
          id: crypto.randomUUID(),
          filename: f.name,
          fileBase64: await fileToBase64(f),
          mime: "application/pdf",
          status: "pendente",
        });
      } else {
        toast.warning(`Ignorado: ${f.name} (apenas PDF ou ZIP)`);
      }
    }
    setItems((prev) => [...prev, ...novos]);
  }

  async function processarTodos() {
    setBusy(true);
    const pendentes = items.filter((i) => i.status === "pendente" || i.status === "erro");
    for (const it of pendentes) {
      setItems((p) => p.map((x) => x.id === it.id ? { ...x, status: "processando", error: undefined } : x));
      try {
        const { data, error } = await supabase.functions.invoke("parse-nota-fiscal", {
          body: { filename: it.filename, mime_type: it.mime, file_base64: it.fileBase64 },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error ?? "Falha na IA");
        const parsed = data.data as Parsed;

        // Match fornecedor por CNPJ
        const cnpj = digitsOnly(parsed.fornecedor?.cnpj);
        let fornecedorId: string | null = null;
        if (cnpj.length === 14) {
          const { data: f } = await supabase
            .from("fornecedores_externos")
            .select("id")
            .eq("cnpj", cnpj)
            .maybeSingle();
          fornecedorId = f?.id ?? null;
        }

        // Match veículo por placa dentro da empresa
        let veiculoId: string | null = null;
        let veiculoPlaca: string | null = null;
        const placa = (parsed.placa_veiculo ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (placa) {
          const { data: v } = await supabase
            .from("veiculos")
            .select("id, placa")
            .eq("empresa_id", empresaId)
            .ilike("placa", `%${placa}%`)
            .limit(1)
            .maybeSingle();
          if (v) { veiculoId = v.id; veiculoPlaca = v.placa; }
        }

        setItems((p) => p.map((x) => x.id === it.id
          ? { ...x, status: "ok", data: parsed, fornecedorId, veiculoId, veiculoPlaca }
          : x));
      } catch (e: any) {
        setItems((p) => p.map((x) => x.id === it.id
          ? { ...x, status: "erro", error: e.message || String(e) }
          : x));
      }
    }
    setBusy(false);
  }

  function updateItem(id: string, patch: Partial<Item> & { dataPatch?: Partial<Parsed> }) {
    setItems((p) => p.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, ...patch };
      if (patch.dataPatch) next.data = { ...(x.data ?? {}), ...patch.dataPatch };
      delete (next as any).dataPatch;
      return next;
    }));
  }

  async function salvarItem(it: Item): Promise<boolean> {
    if (!it.data) return false;
    if (!it.veiculoId) { toast.error(`${it.filename}: selecione o veículo`); return false; }
    if (!it.fornecedorId) {
      // criar fornecedor mínimo se houver CNPJ
      const cnpj = digitsOnly(it.data.fornecedor?.cnpj);
      const nome = it.data.fornecedor?.razao_social || it.data.fornecedor?.nome_fantasia;
      if (cnpj && nome) {
        const { data: novoForn, error } = await supabase.from("fornecedores_externos")
          .insert({ nome, cnpj, ativo: true })
          .select("id").single();
        if (error) { toast.error(`Erro fornecedor: ${error.message}`); return false; }
        it.fornecedorId = novoForn.id;
      } else {
        toast.error(`${it.filename}: fornecedor sem CNPJ/nome — edite manualmente`);
        return false;
      }
    }

    updateItem(it.id, { status: "salvando" });

    // upload PDF para storage
    const ext = it.filename.split(".").pop() || "pdf";
    const path = `${empresaId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const bytes = Uint8Array.from(atob(it.fileBase64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabase.storage
      .from("notas-fornecedores")
      .upload(path, bytes, { contentType: it.mime, upsert: false });
    if (upErr) { updateItem(it.id, { status: "erro", error: upErr.message }); return false; }

    const dt = it.data.data_emissao || new Date().toISOString().slice(0, 10);
    const valor = Number(it.data.valor_total || 0);

    const { error: insErr } = await supabase.from("manutencoes").insert({
      empresa_id: empresaId,
      veiculo_id: it.veiculoId,
      fornecedor_externo_id: it.fornecedorId,
      tipo: (it.data.tipo_servico as any) || "Corretiva",
      descricao: it.data.descricao || `NF ${it.data.numero_nf ?? ""}`.trim(),
      status: "Concluída",
      prioridade: "Normal",
      data_solicitacao: `${dt}T00:00:00`,
      data_conclusao: `${dt}T00:00:00`,
      valor_final: valor,
      custo_fornecedor: valor,
      valor_bruto_pecas: it.data.valor_pecas ?? null,
      valor_bruto_servicos: it.data.valor_servicos ?? null,
      oficina_nome: it.data.fornecedor?.razao_social || it.data.fornecedor?.nome_fantasia || "—",
      nota_fiscal: it.data.numero_nf || null,
      comprovante_url: path,
      observacoes: `Importada via IA · arquivo ${it.filename}`,
      confirmada_pelo_solicitante: true,
    });
    if (insErr) { updateItem(it.id, { status: "erro", error: insErr.message }); return false; }
    updateItem(it.id, { status: "salvo" });
    return true;
  }

  async function salvarTodos() {
    setBusy(true);
    let ok = 0;
    for (const it of items.filter((x) => x.status === "ok")) {
      if (await salvarItem(it)) ok++;
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(`${ok} nota(s) importada(s) como OS concluída(s)`);
      onSaved();
    }
  }

  const pendentes = items.filter((i) => i.status === "pendente" || i.status === "erro").length;
  const prontos = items.filter((i) => i.status === "ok").length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Enviar Notas Fiscais de Fornecedores (IA)
          </DialogTitle>
        </DialogHeader>

        <Card className="p-4 border-dashed border-2">
          <Label className="text-sm font-medium">Anexe PDFs individuais ou um arquivo ZIP</Label>
          <Input
            type="file"
            multiple
            accept=".pdf,.zip,application/pdf,application/zip"
            onChange={(e) => handleFiles(e.target.files)}
            className="mt-2"
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground mt-2">
            A IA extrai CNPJ, fornecedor, valor, placa do veículo, descrição e tipo de serviço.
            Cada nota vira uma OS "Concluída" pronta para faturar.
          </p>
        </Card>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{items.length} arquivo(s)</Badge>
            {pendentes > 0 && <Badge variant="outline">{pendentes} pendente(s)</Badge>}
            {prontos > 0 && <Badge variant="default">{prontos} processado(s)</Badge>}
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setItems([])} disabled={busy}>
                Limpar
              </Button>
              <Button size="sm" onClick={processarTodos} disabled={busy || pendentes === 0}>
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Processar com IA
              </Button>
              <Button size="sm" variant="default" onClick={salvarTodos} disabled={busy || prontos === 0}>
                <Upload className="w-4 h-4 mr-1" /> Salvar como OS
              </Button>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>NF</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Fornecedor (CNPJ)</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell><FileText className="w-4 h-4 text-muted-foreground" /></TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate" title={it.filename}>{it.filename}</TableCell>
                    <TableCell>
                      <Input
                        className="h-7 text-xs w-24"
                        value={it.data?.numero_nf ?? ""}
                        onChange={(e) => updateItem(it.id, { dataPatch: { numero_nf: e.target.value } })}
                        disabled={busy || it.status === "salvo"}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        className="h-7 text-xs w-32"
                        value={it.data?.data_emissao ?? ""}
                        onChange={(e) => updateItem(it.id, { dataPatch: { data_emissao: e.target.value } })}
                        disabled={busy || it.status === "salvo"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input
                          className="h-7 text-xs w-44"
                          placeholder="Razão social"
                          value={it.data?.fornecedor?.razao_social ?? ""}
                          onChange={(e) => updateItem(it.id, {
                            dataPatch: { fornecedor: { ...(it.data?.fornecedor ?? {}), razao_social: e.target.value } }
                          })}
                          disabled={busy || it.status === "salvo"}
                        />
                        <Input
                          className="h-7 text-xs w-44 font-mono"
                          placeholder="CNPJ"
                          value={it.data?.fornecedor?.cnpj ?? ""}
                          onChange={(e) => updateItem(it.id, {
                            dataPatch: { fornecedor: { ...(it.data?.fornecedor ?? {}), cnpj: e.target.value } }
                          })}
                          disabled={busy || it.status === "salvo"}
                        />
                        {it.fornecedorId
                          ? <Badge variant="default" className="text-[10px]">vinculado</Badge>
                          : <Badge variant="outline" className="text-[10px]">novo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-7 text-xs w-24 uppercase font-mono"
                        value={it.veiculoPlaca ?? it.data?.placa_veiculo ?? ""}
                        onChange={async (e) => {
                          const placa = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                          updateItem(it.id, { dataPatch: { placa_veiculo: placa }, veiculoPlaca: placa, veiculoId: null });
                          if (placa.length >= 6) {
                            const { data: v } = await supabase.from("veiculos")
                              .select("id, placa").eq("empresa_id", empresaId)
                              .ilike("placa", `%${placa}%`).limit(1).maybeSingle();
                            if (v) updateItem(it.id, { veiculoId: v.id, veiculoPlaca: v.placa });
                          }
                        }}
                        disabled={busy || it.status === "salvo"}
                      />
                      {it.veiculoId
                        ? <Badge variant="default" className="text-[10px] mt-1">ok</Badge>
                        : <Badge variant="destructive" className="text-[10px] mt-1">não encontrado</Badge>}
                    </TableCell>
                    <TableCell>
                      <select
                        className="h-7 text-xs border rounded px-1 bg-background"
                        value={it.data?.tipo_servico ?? "Corretiva"}
                        onChange={(e) => updateItem(it.id, { dataPatch: { tipo_servico: e.target.value } })}
                        disabled={busy || it.status === "salvo"}
                      >
                        {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number" step="0.01"
                        className="h-7 text-xs w-24 text-right font-mono"
                        value={it.data?.valor_total ?? ""}
                        onChange={(e) => updateItem(it.id, { dataPatch: { valor_total: Number(e.target.value) } })}
                        disabled={busy || it.status === "salvo"}
                      />
                    </TableCell>
                    <TableCell>
                      {it.status === "pendente" && <Badge variant="outline">aguardando</Badge>}
                      {it.status === "processando" && <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />IA</Badge>}
                      {it.status === "ok" && <Badge variant="default"><CheckCircle2 className="w-3 h-3 mr-1" />pronto</Badge>}
                      {it.status === "salvando" && <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />salvando</Badge>}
                      {it.status === "salvo" && <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />salvo</Badge>}
                      {it.status === "erro" && (
                        <Badge variant="destructive" title={it.error}>
                          <AlertCircle className="w-3 h-3 mr-1" />erro
                        </Badge>
                      )}
                      {it.error && <p className="text-[10px] text-destructive mt-1 max-w-[160px] truncate" title={it.error}>{it.error}</p>}
                    </TableCell>
                    <TableCell>
                      {it.status !== "salvo" && (
                        <Button size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} disabled={busy}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
