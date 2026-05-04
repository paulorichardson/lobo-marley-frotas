import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, Download, Trash2, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";

const TIPOS = [
  { value: "contrato", label: "Contrato" },
  { value: "edital", label: "Edital" },
  { value: "termo_referencia", label: "Termo de Referência" },
  { value: "outro", label: "Outros" },
];

type Anexo = {
  id: string;
  empresa_id: string;
  tipo_documento: string;
  nome_arquivo: string;
  url_arquivo: string;
  storage_path: string | null;
  tamanho_bytes: number | null;
  criado_em: string;
};

export function ContratoAnexosSection({ empresaId }: { empresaId: string }) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState("contrato");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contrato_anexos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false });
    if (error) toast.error(error.message);
    setAnexos((data ?? []) as Anexo[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [empresaId]);

  async function upload() {
    if (!file) return toast.error("Selecione um arquivo PDF");
    setUploading(true);
    const path = `${empresaId}/${Date.now()}_${file.name}`;
    const up = await supabase.storage.from("contratos-anexos").upload(path, file, {
      contentType: file.type || "application/pdf",
      upsert: false,
    });
    if (up.error) { setUploading(false); return toast.error(up.error.message); }

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("contrato_anexos").insert({
      empresa_id: empresaId,
      tipo_documento: tipo,
      nome_arquivo: file.name,
      url_arquivo: path,
      storage_path: path,
      tamanho_bytes: file.size,
      usuario_upload: user?.id,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Anexo enviado");
    setFile(null);
    (document.getElementById("anexo-file") as HTMLInputElement).value = "";
    load();
  }

  async function baixar(a: Anexo) {
    const { data, error } = await supabase.storage
      .from("contratos-anexos")
      .createSignedUrl(a.storage_path ?? a.url_arquivo, 60);
    if (error || !data) return toast.error("Não foi possível gerar link");
    window.open(data.signedUrl, "_blank");
  }

  async function excluir(a: Anexo) {
    if (!confirm(`Excluir "${a.nome_arquivo}"?`)) return;
    if (a.storage_path) {
      await supabase.storage.from("contratos-anexos").remove([a.storage_path]);
    }
    const { error } = await supabase.from("contrato_anexos").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Anexo excluído");
    load();
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Anexos do contrato</h3>
      </div>

      <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <Label>Tipo do documento</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Arquivo PDF</Label>
          <Input id="anexo-file" type="file" accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button onClick={upload} disabled={uploading || !file}>
          {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          Enviar
        </Button>
      </div>

      <div className="divide-y border-t">
        {loading ? (
          <div className="p-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
        ) : anexos.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">Nenhum anexo enviado.</p>
        ) : anexos.map((a) => (
          <div key={a.id} className="py-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{a.nome_arquivo}</p>
              <p className="text-xs text-muted-foreground">
                {TIPOS.find((t) => t.value === a.tipo_documento)?.label ?? a.tipo_documento}
                {" · "}{new Date(a.criado_em).toLocaleDateString("pt-BR")}
                {a.tamanho_bytes ? ` · ${(a.tamanho_bytes / 1024).toFixed(0)} KB` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => baixar(a)}>
              <Download className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => excluir(a)}>
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
