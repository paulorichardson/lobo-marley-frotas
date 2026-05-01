import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  consultarPlaca,
  formatarPlaca,
  normalizarPlaca,
  placaValida,
} from "@/lib/placa";
import {
  CATEGORIAS,
  COMBUSTIVEIS,
  STATUS_VEICULO,
  TIPOS_FOTO,
  vencendoEmBreve,
} from "@/lib/veiculo-constants";
import { toast } from "sonner";
import { Loader2, Upload, X, AlertTriangle, ImagePlus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VeiculoFormValues {
  id?: string;
  placa: string;
  marca: string;
  modelo: string;
  ano_fabricacao: string;
  ano_modelo: string;
  cor: string;
  combustivel: string;
  categoria: string;
  chassi: string;
  renavam: string;
  km_atual: string;
  km_proxima_revisao: string;
  status: string;
  vencimento_licenciamento: string;
  vencimento_ipva: string;
  vencimento_seguro: string;
  motorista_id: string;
  foto_principal_url: string;
  doc_crlv_url: string;
  doc_seguro_url: string;
}

const EMPTY: VeiculoFormValues = {
  placa: "",
  marca: "",
  modelo: "",
  ano_fabricacao: "",
  ano_modelo: "",
  cor: "",
  combustivel: "Flex",
  categoria: "Carro",
  chassi: "",
  renavam: "",
  km_atual: "0",
  km_proxima_revisao: "",
  status: "Ativo",
  vencimento_licenciamento: "",
  vencimento_ipva: "",
  vencimento_seguro: "",
  motorista_id: "",
  foto_principal_url: "",
  doc_crlv_url: "",
  doc_seguro_url: "",
};

interface FotoExtra {
  file: File;
  tipo: string;
  preview: string;
}

interface Motorista {
  id: string;
  nome: string;
  email: string;
}

interface Props {
  initial?: Partial<VeiculoFormValues>;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}

export function VeiculoForm({ initial, onSaved, onCancel }: Props) {
  const { user } = useAuth();
  const [values, setValues] = useState<VeiculoFormValues>({ ...EMPTY, ...initial });
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [consultandoPlaca, setConsultandoPlaca] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>(values.foto_principal_url || "");
  const [crlvFile, setCrlvFile] = useState<File | null>(null);
  const [seguroFile, setSeguroFile] = useState<File | null>(null);
  const [fotosExtras, setFotosExtras] = useState<FotoExtra[]>([]);
  const placaConsultada = useRef<string>("");

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorista");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return;
      const { data: perfis } = await supabase
        .from("perfis")
        .select("id, nome, email")
        .in("id", ids)
        .order("nome");
      setMotoristas(perfis ?? []);
    })();
  }, []);

  function set<K extends keyof VeiculoFormValues>(key: K, value: VeiculoFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handlePlacaBlur() {
    const p = normalizarPlaca(values.placa);
    if (!placaValida(p) || p === placaConsultada.current) return;
    placaConsultada.current = p;
    setConsultandoPlaca(true);
    const dados = await consultarPlaca(p);
    setConsultandoPlaca(false);
    if (!dados) {
      toast.warning("Placa não encontrada — preencha manualmente");
      return;
    }
    setValues((v) => ({
      ...v,
      placa: p,
      marca: dados.marca || v.marca,
      modelo: dados.modelo || v.modelo,
      ano_fabricacao: dados.ano ? String(dados.ano) : v.ano_fabricacao,
      ano_modelo: dados.anoModelo ? String(dados.anoModelo) : v.ano_modelo,
      cor: dados.cor || v.cor,
      combustivel: dados.combustivel || v.combustivel,
      chassi: dados.chassi || v.chassi,
    }));
    toast.success("Dados da placa carregados");
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFotoFile(f);
    setFotoPreview(URL.createObjectURL(f));
  }

  function handleFotosExtrasChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const novas = files.map((f) => ({ file: f, tipo: "geral", preview: URL.createObjectURL(f) }));
    setFotosExtras((prev) => [...prev, ...novas]);
    e.target.value = "";
  }

  async function uploadArquivo(bucket: string, file: File, prefix: string): Promise<string> {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    return path;
  }

  function validar(): string | null {
    if (!placaValida(values.placa)) return "Placa inválida (use AAA-0000 ou AAA0A00)";
    if (!values.marca.trim()) return "Marca é obrigatória";
    if (!values.modelo.trim()) return "Modelo é obrigatório";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const erro = validar();
    if (erro) {
      toast.error(erro);
      return;
    }
    if (!user) return;
    setSalvando(true);
    try {
      const placaNorm = normalizarPlaca(values.placa);

      // Uploads
      let foto_principal_url = values.foto_principal_url;
      let doc_crlv_url = values.doc_crlv_url;
      let doc_seguro_url = values.doc_seguro_url;

      if (fotoFile) {
        foto_principal_url = await uploadArquivo("veiculos-fotos", fotoFile, placaNorm);
      }
      if (crlvFile) {
        doc_crlv_url = await uploadArquivo("veiculos-docs", crlvFile, `${placaNorm}/crlv`);
      }
      if (seguroFile) {
        doc_seguro_url = await uploadArquivo("veiculos-docs", seguroFile, `${placaNorm}/seguro`);
      }

      // empresa do gestor logado (multi-tenant)
      const { data: empresaIdData } = await supabase.rpc("get_empresa_id");
      const empresa_id = empresaIdData ?? null;

      const payload: any = {
        placa: placaNorm,
        marca: values.marca.trim(),
        modelo: values.modelo.trim(),
        ano_fabricacao: values.ano_fabricacao ? Number(values.ano_fabricacao) : null,
        ano_modelo: values.ano_modelo ? Number(values.ano_modelo) : null,
        cor: values.cor || null,
        combustivel: values.combustivel || null,
        categoria: values.categoria || null,
        chassi: values.chassi || null,
        renavam: values.renavam || null,
        km_atual: values.km_atual ? Number(values.km_atual) : 0,
        km_proxima_revisao: values.km_proxima_revisao ? Number(values.km_proxima_revisao) : null,
        status: values.status,
        vencimento_licenciamento: values.vencimento_licenciamento || null,
        vencimento_ipva: values.vencimento_ipva || null,
        vencimento_seguro: values.vencimento_seguro || null,
        motorista_id: values.motorista_id || null,
        foto_principal_url: foto_principal_url || null,
        doc_crlv_url: doc_crlv_url || null,
        doc_seguro_url: doc_seguro_url || null,
        cadastrado_por: user.id,
      };

      let veiculoId = values.id;
      if (veiculoId) {
        const { error } = await supabase.from("veiculos").update(payload).eq("id", veiculoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("veiculos")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        veiculoId = data.id;
      }

      // Upload das fotos extras vinculadas
      if (fotosExtras.length && veiculoId) {
        for (const fx of fotosExtras) {
          try {
            const url = await uploadArquivo("veiculos-fotos", fx.file, `${placaNorm}/galeria`);
            await supabase.from("veiculo_fotos").insert({
              veiculo_id: veiculoId,
              url,
              tipo: fx.tipo,
              enviado_por: user.id,
            });
          } catch (err) {
            console.error("Erro upload foto extra:", err);
          }
        }
      }

      toast.success(values.id ? "Veículo atualizado" : "Veículo cadastrado");
      onSaved(veiculoId!);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar veículo");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identificação */}
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold">Identificação</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-1">
            <Label htmlFor="placa">Placa *</Label>
            <div className="relative">
              <Input
                id="placa"
                value={formatarPlaca(values.placa)}
                onChange={(e) => set("placa", normalizarPlaca(e.target.value))}
                onBlur={handlePlacaBlur}
                placeholder="AAA-0000"
                maxLength={8}
                className="uppercase font-mono tracking-wider"
              />
              {consultandoPlaca && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-accent" />
              )}
            </div>
            {values.placa && !placaValida(values.placa) && (
              <p className="text-xs text-destructive">Formato inválido</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="marca">Marca *</Label>
            <Input id="marca" value={values.marca} onChange={(e) => set("marca", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="modelo">Modelo *</Label>
            <Input id="modelo" value={values.modelo} onChange={(e) => set("modelo", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ano_fab">Ano fabricação</Label>
            <Input
              id="ano_fab"
              type="number"
              value={values.ano_fabricacao}
              onChange={(e) => set("ano_fabricacao", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ano_mod">Ano modelo</Label>
            <Input
              id="ano_mod"
              type="number"
              value={values.ano_modelo}
              onChange={(e) => set("ano_modelo", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cor">Cor</Label>
            <Input id="cor" value={values.cor} onChange={(e) => set("cor", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Combustível</Label>
            <Select value={values.combustivel} onValueChange={(v) => set("combustivel", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMBUSTIVEIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={values.categoria} onValueChange={(v) => set("categoria", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={values.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_VEICULO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="chassi">Chassi</Label>
            <Input id="chassi" value={values.chassi} onChange={(e) => set("chassi", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renavam">Renavam</Label>
            <Input id="renavam" value={values.renavam} onChange={(e) => set("renavam", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="km">KM atual</Label>
            <Input id="km" type="number" value={values.km_atual} onChange={(e) => set("km_atual", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="km_rev">KM próxima revisão</Label>
            <Input
              id="km_rev"
              type="number"
              value={values.km_proxima_revisao}
              onChange={(e) => set("km_proxima_revisao", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label>Motorista vinculado</Label>
            <Select value={values.motorista_id || "none"} onValueChange={(v) => set("motorista_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sem motorista" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— sem motorista —</SelectItem>
                {motoristas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome} — {m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Vencimentos */}
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold">Documentação</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <DataField label="Vencimento Licenciamento" value={values.vencimento_licenciamento} onChange={(v) => set("vencimento_licenciamento", v)} />
          <DataField label="Vencimento IPVA" value={values.vencimento_ipva} onChange={(v) => set("vencimento_ipva", v)} />
          <DataField label="Vencimento Seguro" value={values.vencimento_seguro} onChange={(v) => set("vencimento_seguro", v)} />
        </div>
      </Card>

      {/* Foto principal */}
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold">Foto principal</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-40 h-32 rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
            {fotoPreview ? (
              <img src={fotoPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <Label htmlFor="foto" className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-accent/10 text-sm">
              <Upload className="w-4 h-4" /> Selecionar foto
            </Label>
            <input id="foto" type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
          </div>
        </div>
      </Card>

      {/* Galeria */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Galeria de fotos</h3>
          <Label htmlFor="fotos-extras" className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-accent/10 text-sm">
            <ImagePlus className="w-4 h-4" /> Adicionar
          </Label>
          <input id="fotos-extras" type="file" accept="image/*" multiple className="hidden" onChange={handleFotosExtrasChange} />
        </div>
        {fotosExtras.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma foto extra selecionada.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {fotosExtras.map((fx, idx) => (
              <div key={idx} className="relative rounded-lg overflow-hidden border border-border bg-muted/20">
                <img src={fx.preview} alt="" className="w-full h-32 object-cover" />
                <Select value={fx.tipo} onValueChange={(v) => setFotosExtras((arr) => arr.map((x, i) => i === idx ? { ...x, tipo: v } : x))}>
                  <SelectTrigger className="rounded-none border-0 border-t border-border h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_FOTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => setFotosExtras((arr) => arr.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Documentos */}
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold">Documentos</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <FileSlot
            label="CRLV"
            file={crlvFile}
            existingUrl={values.doc_crlv_url}
            onChange={setCrlvFile}
          />
          <FileSlot
            label="Apólice de seguro"
            file={seguroFile}
            existingUrl={values.doc_seguro_url}
            onChange={setSeguroFile}
          />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={salvando}>Cancelar</Button>
        )}
        <Button type="submit" disabled={salvando}>
          {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {values.id ? "Salvar alterações" : "Cadastrar veículo"}
        </Button>
      </div>
    </form>
  );
}

function DataField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const alerta = vencendoEmBreve(value);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cn(alerta && "border-destructive")} />
      {alerta && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Vence em menos de 30 dias
        </p>
      )}
    </div>
  );
}

function FileSlot({ label, file, existingUrl, onChange }: { label: string; file: File | null; existingUrl: string; onChange: (f: File | null) => void }) {
  const id = `file-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-accent/10 text-sm flex-1">
          <FileText className="w-4 h-4" />
          <span className="truncate">{file?.name || (existingUrl ? "Substituir arquivo" : "Selecionar arquivo")}</span>
        </Label>
        <input id={id} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
        {file && (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      {existingUrl && !file && <p className="text-xs text-muted-foreground">Arquivo atual mantido</p>}
    </div>
  );
}
