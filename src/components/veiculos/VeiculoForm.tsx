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
import { consultarPlacaApiBrasil } from "@/lib/placa.functions";

import {
  CATEGORIAS,
  COMBUSTIVEIS,
  STATUS_VEICULO,
  TIPOS_FOTO,
  TIPOS_BEM,
  getTipoBem,
  vencendoEmBreve,
} from "@/lib/veiculo-constants";
import { toast } from "sonner";
import { Loader2, Upload, X, AlertTriangle, ImagePlus, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCrlv } from "@/lib/crlv.functions";

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
  setor: string;
  tipo_bem: string;
  horimetro: string;
  numero_patrimonio: string;
  numero_serie: string;
  codigo_siga: string;
  tipo_combustivel_siga: string;
}

const TIPOS_COMBUSTIVEL_SIGA = [
  "ALCOOL",
  "GASOLINA",
  "DIESEL",
  "GNV",
  "FLEX",
  "ELETRICO",
  "HIBRIDO",
];

const SETORES_SUGERIDOS = [
  "Gabinete",
  "Obras",
  "Saúde",
  "SAMU 192",
  "Educação",
  "Assistência Social",
  "Infraestrutura",
  "Agricultura",
  "Meio Ambiente",
  "Cultura",
  "Esportes",
  "Administração",
];

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
  setor: "",
  tipo_bem: "veiculo",
  horimetro: "",
  numero_patrimonio: "",
  numero_serie: "",
  codigo_siga: "",
  tipo_combustivel_siga: "",
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
  const [importandoCrlv, setImportandoCrlv] = useState(false);
  const placaConsultada = useRef<string>("");

  async function handleCrlvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Envie o CRLV em PDF");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("PDF muito grande (máx 8MB)");
      return;
    }
    setImportandoCrlv(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada, faça login novamente");
        return;
      }
      // Converte para base64
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const pdfBase64 = btoa(binary);

      const res = await parseCrlv({
        data: { pdfBase64, fileName: file.name, accessToken: token },
      });
      const d = res.dados ?? {};
      setValues((v) => ({
        ...v,
        placa: d.placa || v.placa,
        marca: d.marca || v.marca,
        modelo: d.modelo || v.modelo,
        ano_fabricacao: d.ano_fabricacao ? String(d.ano_fabricacao) : v.ano_fabricacao,
        ano_modelo: d.ano_modelo ? String(d.ano_modelo) : v.ano_modelo,
        cor: d.cor || v.cor,
        combustivel: d.combustivel || v.combustivel,
        categoria: d.categoria || v.categoria,
        chassi: d.chassi || v.chassi,
        renavam: d.renavam || v.renavam,
        vencimento_licenciamento: d.licenciamento_data || v.vencimento_licenciamento,
      }));
      // Guarda o PDF como CRLV anexado também
      setCrlvFile(file);
      if (res.licenciamento_calculado) {
        toast.success("CRLV importado. Vencimento calculado pela UF + final da placa.");
      } else {
        toast.success("CRLV importado com sucesso");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Falha ao importar CRLV");
    } finally {
      setImportandoCrlv(false);
    }
  }

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
    const tipo = getTipoBem(values.tipo_bem);
    if (tipo.validaPlaca) {
      if (!placaValida(values.placa)) return "Placa inválida (use AAA-0000 ou AAA0A00)";
    } else {
      if (!values.placa.trim()) return `${tipo.placaLabel} é obrigatório`;
    }
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
      const tipo = getTipoBem(values.tipo_bem);
      const placaNorm = tipo.validaPlaca
        ? normalizarPlaca(values.placa)
        : values.placa.trim().toUpperCase();

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
        empresa_id,
        setor: values.setor.trim() || null,
        tipo_bem: values.tipo_bem || "veiculo",
        horimetro: values.horimetro ? Number(values.horimetro) : null,
        numero_patrimonio: values.numero_patrimonio.trim() || null,
        numero_serie: values.numero_serie.trim() || null,
        codigo_siga: values.codigo_siga.trim() || null,
        tipo_combustivel_siga: values.tipo_combustivel_siga || null,
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
              empresa_id,
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
      {/* Importar via CRLV (IA) */}
      <Card className="p-4 border-accent/40 bg-accent/5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Cadastro automático via CRLV
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Envie o PDF do CRLV-e. A IA preenche placa, RENAVAM, chassi, marca/modelo, ano, cor,
            combustível e calcula o vencimento do licenciamento pela UF + final da placa.
          </p>
        </div>
        <Label
          htmlFor="crlv-import"
          className={cn(
            "cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium",
            "bg-accent text-accent-foreground hover:bg-accent/90 transition-colors whitespace-nowrap",
            importandoCrlv && "opacity-60 pointer-events-none",
          )}
        >
          {importandoCrlv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {importandoCrlv ? "Lendo CRLV..." : "Importar CRLV (PDF)"}
        </Label>
        <input
          id="crlv-import"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleCrlvImport}
          disabled={importandoCrlv}
        />
      </Card>

      {/* Identificação */}
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold">Identificação</h3>

        <div className="space-y-1.5">
          <Label>Tipo de bem *</Label>
          <Select value={values.tipo_bem} onValueChange={(v) => set("tipo_bem", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_BEM.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Use "Máquina" para tratores, retroescavadeiras, pá-carregadeiras, etc. (sem placa veicular).
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-1">
            <Label htmlFor="placa">{getTipoBem(values.tipo_bem).placaLabel} *</Label>
            <div className="relative">
              <Input
                id="placa"
                value={getTipoBem(values.tipo_bem).validaPlaca ? formatarPlaca(values.placa) : values.placa}
                onChange={(e) => {
                  const t = getTipoBem(values.tipo_bem);
                  set("placa", t.validaPlaca ? normalizarPlaca(e.target.value) : e.target.value.toUpperCase());
                }}
                onBlur={getTipoBem(values.tipo_bem).validaPlaca ? handlePlacaBlur : undefined}
                placeholder={getTipoBem(values.tipo_bem).placaPlaceholder}
                maxLength={20}
                className="uppercase font-mono tracking-wider"
              />
              {consultandoPlaca && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-accent" />
              )}
            </div>
            {getTipoBem(values.tipo_bem).validaPlaca && values.placa && !placaValida(values.placa) && (
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
          {getTipoBem(values.tipo_bem).validaPlaca && (
            <div className="space-y-1.5">
              <Label htmlFor="renavam">Renavam</Label>
              <Input id="renavam" value={values.renavam} onChange={(e) => set("renavam", e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="patrimonio">Nº Patrimônio</Label>
            <Input id="patrimonio" value={values.numero_patrimonio} onChange={(e) => set("numero_patrimonio", e.target.value)} placeholder="Ex.: 12345" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="serie">Nº Série</Label>
            <Input id="serie" value={values.numero_serie} onChange={(e) => set("numero_serie", e.target.value)} />
          </div>
          {getTipoBem(values.tipo_bem).usaHorimetro ? (
            <div className="space-y-1.5">
              <Label htmlFor="horimetro">Horímetro (horas de uso)</Label>
              <Input id="horimetro" type="number" value={values.horimetro} onChange={(e) => set("horimetro", e.target.value)} placeholder="0" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="km">KM atual</Label>
              <Input id="km" type="number" value={values.km_atual} onChange={(e) => set("km_atual", e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="km_rev">{getTipoBem(values.tipo_bem).usaHorimetro ? "Horas próx. revisão" : "KM próxima revisão"}</Label>
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
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="setor">Setor / Secretaria (para órgãos públicos)</Label>
            <Input
              id="setor"
              list="setores-sugeridos"
              value={values.setor}
              onChange={(e) => set("setor", e.target.value)}
              placeholder="Ex.: Saúde, Educação, Obras, Gabinete..."
            />
            <datalist id="setores-sugeridos">
              {SETORES_SUGERIDOS.map((s) => <option key={s} value={s} />)}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Use para subdividir a frota por secretaria/órgão. Deixe vazio se não se aplica.
            </p>
          </div>
        </div>
      </Card>

      {/* SIGA-TCM */}
      <Card className="p-5 space-y-4 border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/10">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            🏛️ Configuração SIGA-TCM
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">TCM/BA</span>
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Esses dados são usados na exportação para o Tribunal de Contas dos Municípios da Bahia. Preencha apenas se a prefeitura usa o SIGA-TCM.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="codigo_siga">Código SIGA</Label>
            <Input
              id="codigo_siga"
              value={values.codigo_siga}
              onChange={(e) => set("codigo_siga", e.target.value)}
              placeholder="Código interno da prefeitura"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de Combustível SIGA</Label>
            <Select
              value={values.tipo_combustivel_siga || "none"}
              onValueChange={(v) => set("tipo_combustivel_siga", v === "none" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="— não definido —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— não definido —</SelectItem>
                {TIPOS_COMBUSTIVEL_SIGA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Vencimentos — só para veículos com placa */}
      {getTipoBem(values.tipo_bem).mostraDocs && (
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Documentação</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <DataField label="Vencimento Licenciamento" value={values.vencimento_licenciamento} onChange={(v) => set("vencimento_licenciamento", v)} />
            <DataField label="Vencimento IPVA" value={values.vencimento_ipva} onChange={(v) => set("vencimento_ipva", v)} />
            <DataField label="Vencimento Seguro" value={values.vencimento_seguro} onChange={(v) => set("vencimento_seguro", v)} />
          </div>
        </Card>
      )}

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
