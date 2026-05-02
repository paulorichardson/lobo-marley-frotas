import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { CameraInput } from "@/components/CameraInput";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyEmpresaGestores } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/motorista/solicitar")({
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <SolicitarPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const TIPOS_PROBLEMA = [
  "Pneu", "Freio", "Motor", "Elétrica", "Funilaria",
  "Ar-condicionado", "Outro",
];

const URGENCIAS = [
  { value: "Baixa", label: "Baixa", color: "bg-green-100 border-green-500 text-green-700", emoji: "🟢" },
  { value: "Normal", label: "Normal", color: "bg-yellow-100 border-yellow-500 text-yellow-700", emoji: "🟡" },
  { value: "Alta", label: "Alta", color: "bg-orange-100 border-orange-500 text-orange-700", emoji: "🟠" },
  { value: "Urgente", label: "Urgente", color: "bg-red-100 border-red-500 text-red-700", emoji: "🔴" },
];

function SolicitarPage() {
  const { user, empresaId } = useAuth();
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const [tipo, setTipo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [urgencia, setUrgencia] = useState("Normal");
  const [foto, setFoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("veiculos")
      .select("id")
      .eq("motorista_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setVeiculoId(data.id);
      });
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !empresaId) return toast.error("Sessão sem empresa vinculada");
    if (!veiculoId) return toast.error("Nenhum veículo vinculado");
    if (!tipo) return toast.error("Selecione o tipo do problema");
    if (!descricao.trim()) return toast.error("Descrição obrigatória");

    setLoading(true);
    try {
      let fotoUrl: string | null = null;
      if (foto) {
        const path = `${user.id}/${Date.now()}_solicitacao.jpg`;
        const { error: upErr } = await supabase.storage
          .from("checklists-fotos")
          .upload(path, foto);
        if (upErr) throw upErr;
        fotoUrl = supabase.storage
          .from("checklists-fotos")
          .getPublicUrl(path).data.publicUrl;
      }

      const { data, error } = await supabase
        .from("solicitacoes")
        .insert({
          motorista_id: user.id,
          veiculo_id: veiculoId,
          empresa_id: empresaId,
          tipo_problema: tipo,
          descricao,
          urgencia,
          foto_url: fotoUrl,
          status: "Aberta",
        })
        .select("id")
        .single();
      if (error) throw error;

      await notifyEmpresaGestores({
        empresaId,
        titulo: `Nova solicitação (${urgencia})`,
        mensagem: `${tipo}: ${descricao.slice(0, 80)}`,
        tipo: urgencia === "Urgente" || urgencia === "Alta" ? "alerta" : "info",
      });

      setSucesso(data.id.slice(0, 8).toUpperCase());
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar solicitação");
    } finally {
      setLoading(false);
    }
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] gap-4 max-w-md mx-auto">
        <CheckCircle2 size={80} className="text-green-500" />
        <h2 className="text-2xl font-bold">Solicitação enviada!</h2>
        <p className="text-muted-foreground">Número da solicitação:</p>
        <p className="text-4xl font-mono font-bold bg-muted rounded-xl px-6 py-3">
          #{sucesso}
        </p>
        <p className="text-sm text-muted-foreground">
          O gestor foi notificado e analisará seu chamado.
        </p>
        <Button
          className="mt-4 w-full"
          onClick={() => {
            setSucesso(null);
            setTipo("");
            setDescricao("");
            setUrgencia("Normal");
            setFoto(null);
          }}
        >
          Nova solicitação
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-5 pb-24 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Solicitar manutenção</h1>

      <div>
        <Label className="font-semibold">Tipo do problema *</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="mt-1 h-12">
            <SelectValue placeholder="Selecione o problema..." />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_PROBLEMA.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="font-semibold">Descrição *</Label>
        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descreva o problema em detalhes..."
          required
          rows={4}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="font-semibold">Urgência</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {URGENCIAS.map((u) => (
            <button
              key={u.value}
              type="button"
              onClick={() => setUrgencia(u.value)}
              className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                urgencia === u.value
                  ? u.color
                  : "bg-muted border-transparent text-muted-foreground"
              }`}
            >
              {u.emoji} {u.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="font-semibold">Foto (opcional)</Label>
        <CameraInput label="Tirar foto do problema" onChange={setFoto} />
      </div>

      <Button
        type="submit"
        className="w-full h-14 text-lg font-bold"
        disabled={loading || !veiculoId}
      >
        {loading ? "Enviando..." : "Enviar solicitação"}
      </Button>
    </form>
  );
}
