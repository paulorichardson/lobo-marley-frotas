import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraInput } from "@/components/CameraInput";
import { uploadFile } from "@/lib/upload";
import { notifyUser } from "@/lib/notify";
import { toast } from "sonner";
import { Loader2, ChevronLeft, ChevronRight, Send, Search, Megaphone, Star, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  km_atual: number;
  foto_principal_url: string | null;
}

interface Fornecedor {
  id: string;
  user_id: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  cidade: string | null;
  estado: string | null;
  tipos_fornecimento: string[];
  logo_url: string | null;
}

const TIPOS_PROBLEMA = [
  { value: "Mecânica / Motor", icon: "🔧", tiposCompat: ["oficina", "mecanica"] },
  { value: "Elétrica", icon: "⚡", tiposCompat: ["oficina", "eletrica"] },
  { value: "Pneu / Suspensão", icon: "🛞", tiposCompat: ["oficina", "pneus", "pecas"] },
  { value: "Funilaria / Pintura", icon: "🎨", tiposCompat: ["oficina", "funilaria"] },
  { value: "Ar-condicionado", icon: "❄️", tiposCompat: ["oficina", "ar"] },
  { value: "Troca de peças", icon: "🔩", tiposCompat: ["oficina", "pecas"] },
  { value: "Revisão / Preventiva", icon: "🔍", tiposCompat: ["oficina"] },
  { value: "Diagnóstico", icon: "📋", tiposCompat: ["oficina"] },
  { value: "Outros", icon: "📦", tiposCompat: [] },
];

const URGENCIAS = [
  { value: "Baixa", label: "Baixa", desc: "pode aguardar", color: "🟢", className: "border-emerald-500" },
  { value: "Normal", label: "Normal", desc: "esta semana", color: "🟡", className: "border-yellow-500" },
  { value: "Alta", label: "Alta", desc: "hoje", color: "🟠", className: "border-orange-500" },
  { value: "Urgente", label: "Urgente", desc: "imediato", color: "🔴", className: "border-red-500" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function NovaSolicitacaoModal({ open, onClose, onCreated }: Props) {
  const { user, empresaId } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [veiculoId, setVeiculoId] = useState("");
  const [tipoProblema, setTipoProblema] = useState("");
  const [descricao, setDescricao] = useState("");
  const [urgencia, setUrgencia] = useState("Normal");
  const [kmAtual, setKmAtual] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);

  // Step 2
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [enviarRede, setEnviarRede] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [fornecedorExterno, setFornecedorExterno] = useState("");

  // Step 3
  const [valorMaximo, setValorMaximo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [obs, setObs] = useState("");
  const [exigirOrcamento, setExigirOrcamento] = useState(true);

  const veiculo = veiculos.find((v) => v.id === veiculoId);
  const tipoSelecionado = TIPOS_PROBLEMA.find((t) => t.value === tipoProblema);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setVeiculoId(""); setTipoProblema(""); setDescricao(""); setUrgencia("Normal");
    setKmAtual(""); setFotos([]);
    setFornecedorId(null); setEnviarRede(false); setFiltroTipo("todos"); setBusca(""); setFornecedorExterno("");
    setValorMaximo(""); setPrazo(""); setObs(""); setExigirOrcamento(true);
    carregarVeiculos();
    carregarFornecedores();
  }, [open]);

  useEffect(() => {
    if (veiculo) setKmAtual(String(veiculo.km_atual ?? ""));
  }, [veiculo]);

  async function carregarVeiculos() {
    const { data } = await supabase
      .from("veiculos")
      .select("id, placa, modelo, marca, km_atual, foto_principal_url")
      .order("placa");
    setVeiculos((data ?? []) as any);
  }

  async function carregarFornecedores() {
    const { data } = await supabase
      .from("fornecedores_cadastro")
      .select("id, user_id, razao_social, nome_fantasia, cidade, estado, tipos_fornecimento, logo_url")
      .eq("status", "aprovado");
    setFornecedores((data ?? []) as any);
  }

  function step1Valido() {
    return veiculoId && tipoProblema && descricao.trim().length >= 5 && urgencia;
  }
  function step2Valido() {
    return enviarRede || fornecedorId || fornecedorExterno.trim().length > 2;
  }

  const fornecedoresFiltrados = fornecedores.filter((f) => {
    const tipos = (f.tipos_fornecimento ?? []).map((t) => t.toLowerCase());
    if (filtroTipo !== "todos" && !tipos.some((t) => t.includes(filtroTipo))) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const nome = `${f.razao_social} ${f.nome_fantasia ?? ""} ${f.cidade ?? ""}`.toLowerCase();
      if (!nome.includes(q)) return false;
    }
    // Filtro por compatibilidade com tipo de problema
    if (tipoSelecionado && tipoSelecionado.tiposCompat.length > 0) {
      const compat = tipoSelecionado.tiposCompat.some((tc) =>
        tipos.some((t) => t.includes(tc)),
      );
      if (!compat) return false;
    }
    return true;
  });

  async function enviar() {
    if (!user || !empresaId) {
      toast.error("Sessão inválida");
      return;
    }
    if (!step2Valido()) {
      toast.error("Escolha um fornecedor ou marque 'Enviar para a rede'");
      return;
    }
    setSubmitting(true);
    try {
      // Upload fotos -> primeira vira comprovante_url, demais como observação? simplificado: 1ª foto
      let fotoUrl: string | null = null;
      if (fotos.length > 0) {
        try {
          fotoUrl = await uploadFile("veiculos-fotos", `manutencao/${veiculoId}`, fotos[0], "jpg");
        } catch (e) {
          console.error("upload foto", e);
        }
      }

      const fornecedorEscolhido = enviarRede
        ? null
        : fornecedorId
          ? fornecedores.find((f) => f.id === fornecedorId)?.user_id ?? null
          : null;

      const oficinaNome = enviarRede
        ? null
        : fornecedorId
          ? fornecedores.find((f) => f.id === fornecedorId)?.razao_social ?? null
          : fornecedorExterno || null;

      const payload: any = {
        veiculo_id: veiculoId,
        empresa_id: empresaId,
        solicitado_por: user.id,
        tipo: tipoProblema,
        descricao,
        prioridade: urgencia,
        status: "Solicitada",
        km_na_manutencao: kmAtual ? Number(kmAtual) : null,
        valor_maximo_autorizado: valorMaximo ? Number(valorMaximo) : null,
        prazo_esperado: prazo || null,
        exigir_orcamento: exigirOrcamento,
        observacoes: obs || null,
        comprovante_url: fotoUrl,
        oficina_nome: oficinaNome,
        fornecedor_id: fornecedorEscolhido,
        enviado_para_rede: enviarRede,
        total_orcamentos_recebidos: 0,
      };

      const { data: manut, error } = await supabase
        .from("manutencoes")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // Solicitação vinculada
      await supabase.from("solicitacoes").insert({
        veiculo_id: veiculoId,
        empresa_id: empresaId,
        motorista_id: user.id,
        tipo_problema: tipoProblema,
        descricao,
        urgencia,
        foto_url: fotoUrl,
        manutencao_id: manut.id,
        status: "Aprovada",
      });

      // Notificações
      const tituloUrg = urgencia === "Urgente" ? "🚨 URGENTE — " : "";
      const msg = `${tipoProblema} — ${veiculo?.placa} — Urgência: ${urgencia}${valorMaximo ? ` — até R$ ${Number(valorMaximo).toFixed(2)}` : ""}`;

      if (enviarRede) {
        const userIds = fornecedores
          .map((f) => f.user_id)
          .filter((id): id is string => !!id);
        if (userIds.length > 0) {
          await supabase.from("notificacoes").insert(
            userIds.map((id) => ({
              para_id: id,
              titulo: `${tituloUrg}📢 Nova solicitação aberta para a rede`,
              mensagem: msg,
              tipo: urgencia === "Urgente" ? "alerta" : "info",
              link: "/fornecedor",
            })),
          );
        }
      } else if (fornecedorEscolhido) {
        await notifyUser({
          userId: fornecedorEscolhido,
          titulo: `${tituloUrg}🔧 Nova solicitação de manutenção`,
          mensagem: msg,
          tipo: urgencia === "Urgente" ? "alerta" : "info",
          link: "/fornecedor",
        });
      }

      toast.success(enviarRede ? "Solicitação enviada para a rede!" : "Solicitação enviada!");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Manutenção</DialogTitle>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={cn(
                "flex-1 h-1.5 rounded-full",
                s <= step ? "bg-primary" : "bg-muted",
              )} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Passo {step} de 3 — {step === 1 ? "Veículo e Problema" : step === 2 ? "Escolher Fornecedor" : "Revisão"}
          </p>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Veículo *</Label>
              <Select value={veiculoId} onValueChange={setVeiculoId}>
                <SelectTrigger><SelectValue placeholder="Escolha um veículo" /></SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.placa} · {v.marca} {v.modelo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {veiculo && (
                <Card className="p-3 mt-2 flex gap-3 items-center">
                  {veiculo.foto_principal_url ? (
                    <img src={veiculo.foto_principal_url} alt="" className="w-16 h-16 rounded object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center text-xs">Sem foto</div>
                  )}
                  <div className="text-sm">
                    <p className="font-bold">{veiculo.placa}</p>
                    <p>{veiculo.marca} {veiculo.modelo}</p>
                    <p className="text-xs text-muted-foreground">KM atual: {veiculo.km_atual?.toLocaleString("pt-BR")}</p>
                  </div>
                </Card>
              )}
            </div>

            <div>
              <Label>Tipo de problema *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                {TIPOS_PROBLEMA.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipoProblema(t.value)}
                    className={cn(
                      "p-2 rounded-lg border text-sm text-left",
                      tipoProblema === t.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="text-lg mr-1">{t.icon}</span>{t.value}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Descrição detalhada *</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o problema com detalhes..."
                rows={3}
              />
            </div>

            <div>
              <Label>Urgência *</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                {URGENCIAS.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setUrgencia(u.value)}
                    className={cn(
                      "p-3 rounded-lg border-2 text-center",
                      urgencia === u.value ? `${u.className} bg-muted` : "border-border hover:bg-muted",
                    )}
                  >
                    <div className="text-2xl">{u.color}</div>
                    <div className="font-semibold text-sm">{u.label}</div>
                    <div className="text-xs text-muted-foreground">{u.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>KM atual</Label>
              <Input
                type="number"
                value={kmAtual}
                onChange={(e) => setKmAtual(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Foto do problema (opcional)</Label>
              <CameraInput
                label="Adicionar foto"
                onChange={(f) => setFotos(f ? [f] : [])}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Card
              className={cn(
                "p-4 cursor-pointer border-2 transition",
                enviarRede
                  ? "border-amber-500 bg-blue-950/30 dark:bg-blue-950/40"
                  : "border-dashed hover:border-primary/50",
              )}
              onClick={() => { setEnviarRede(true); setFornecedorId(null); }}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">📢</div>
                <div className="flex-1">
                  <p className="font-bold text-base">Enviar para Toda a Rede</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Todos os fornecedores compatíveis receberão a solicitação e poderão enviar orçamento. Você escolhe o melhor.
                  </p>
                </div>
                {enviarRede && <Check className="w-5 h-5 text-amber-500" />}
              </div>
            </Card>

            <div className="text-center text-xs text-muted-foreground">— OU escolha um fornecedor específico —</div>

            <div className="flex gap-2 flex-wrap">
              {[
                { v: "todos", l: "Todos" },
                { v: "oficina", l: "🔧 Oficina" },
                { v: "pecas", l: "🏪 Peças" },
                { v: "posto", l: "⛽ Posto" },
              ].map((f) => (
                <Button
                  key={f.v}
                  variant={filtroTipo === f.v ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltroTipo(f.v)}
                >
                  {f.l}
                </Button>
              ))}
              <div className="flex-1 min-w-[180px] relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-7 h-9"
                  placeholder="Buscar por nome ou cidade"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
              {fornecedoresFiltrados.length === 0 ? (
                <p className="col-span-2 text-center text-muted-foreground py-6 text-sm">
                  Nenhum fornecedor compatível encontrado.
                </p>
              ) : fornecedoresFiltrados.map((f) => (
                <Card
                  key={f.id}
                  className={cn(
                    "p-3 cursor-pointer border-2 transition",
                    fornecedorId === f.id ? "border-primary bg-primary/5" : "hover:border-primary/40",
                  )}
                  onClick={() => { setFornecedorId(f.id); setEnviarRede(false); }}
                >
                  <div className="flex items-start gap-2">
                    {f.logo_url ? (
                      <img src={f.logo_url} alt="" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs">{f.razao_social.slice(0, 2)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{f.nome_fantasia || f.razao_social}</p>
                      <p className="text-xs text-muted-foreground truncate">{f.cidade}{f.estado ? `/${f.estado}` : ""}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(f.tipos_fornecimento ?? []).slice(0, 3).map((t, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    {fornecedorId === f.id && <Check className="w-5 h-5 text-primary shrink-0" />}
                  </div>
                </Card>
              ))}
            </div>

            <div>
              <Label>Ou descreva um fornecedor externo (não cadastrado)</Label>
              <Input
                value={fornecedorExterno}
                onChange={(e) => { setFornecedorExterno(e.target.value); setFornecedorId(null); setEnviarRede(false); }}
                placeholder="Nome da oficina/fornecedor externo"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Card className="p-3 space-y-2 bg-muted/40">
              <Resumo label="Veículo" v={`${veiculo?.placa} · ${veiculo?.marca} ${veiculo?.modelo}`} />
              <Resumo label="Problema" v={`${tipoSelecionado?.icon} ${tipoProblema}`} />
              <Resumo label="Urgência" v={`${URGENCIAS.find(u=>u.value===urgencia)?.color} ${urgencia}`} />
              <Resumo
                label="Destinatário"
                v={
                  enviarRede
                    ? "📢 Toda a Rede"
                    : fornecedorId
                      ? fornecedores.find((f) => f.id === fornecedorId)?.razao_social ?? "—"
                      : fornecedorExterno || "—"
                }
              />
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Valor máximo autorizado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorMaximo}
                  onChange={(e) => setValorMaximo(e.target.value)}
                  placeholder="Ex: 1500.00"
                />
              </div>
              <div>
                <Label>Prazo esperado</Label>
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Observações para o fornecedor</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={exigirOrcamento} onCheckedChange={(v) => setExigirOrcamento(!!v)} />
              <span className="text-sm">Exigir orçamento antes de executar</span>
            </label>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          )}
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !step1Valido()) || (step === 2 && !step2Valido())}
            >
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={enviar} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar Solicitação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Resumo({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}

export function Estrelas({ valor, onChange, readOnly }: { valor: number; onChange?: (n: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={cn("transition", !readOnly && "hover:scale-110")}
        >
          <Star className={cn("w-5 h-5", n <= valor ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
        </button>
      ))}
    </div>
  );
}
