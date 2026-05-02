import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { CameraInput } from "@/components/CameraInput";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/motorista/solicitar")({
    component: SolicitarPage,
});

const TIPOS_PROBLEMA = [
    "Pneu", "Freio", "Motor", "Eletrica", "Funilaria",
    "Ar-condicionado", "Outro",
  ];

const URGENCIAS = [
  { value: "baixa", label: "Baixa", color: "bg-green-100 border-green-500 text-green-700", emoji: "🟢" },
  { value: "normal", label: "Normal", color: "bg-yellow-100 border-yellow-500 text-yellow-700", emoji: "🟡" },
  { value: "alta", label: "Alta", color: "bg-orange-100 border-orange-500 text-orange-700", emoji: "🟠" },
  { value: "urgente", label: "Urgente", color: "bg-red-100 border-red-500 text-red-700", emoji: "🔴" },
  ];

function SolicitarPage() {
    const { user, empresaId } = useAuth();
    const [tipo, setTipo] = useState("");
    const [descricao, setDescricao] = useState("");
    const [urgencia, setUrgencia] = useState("normal");
    const [fotos, setFotos] = useState<(File | null)[]>([null, null, null, null]);
    const [loading, setLoading] = useState(false);
    const [sucesso, setSucesso] = useState<string | null>(null);

  function setFoto(idx: number, file: File | null) {
        setFotos((prev) => {
                const arr = [...prev];
                arr[idx] = file;
                return arr;
        });
  }

  async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!tipo) { toast.error("Selecione o tipo do problema"); return; }
        if (!descricao.trim()) { toast.error("Descricao obrigatoria"); return; }

      setLoading(true);
        try {
                const fotoUrls: string[] = [];
                for (const foto of fotos) {
                          if (!foto) continue;
                          const path = `solicitacoes/${user?.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
                          const { error } = await supabase.storage.from("fotos").upload(path, foto);
                          if (error) throw error;
                          fotoUrls.push(supabase.storage.from("fotos").getPublicUrl(path).data.publicUrl);
                }

          const { data, error } = await supabase
                  .from("solicitacoes")
                  .insert({
                              motorista_id: user?.id,
                              empresa_id: empresaId,
                              tipo_problema: tipo,
                              descricao,
                              urgencia,
                              fotos: fotoUrls,
                              status: "aberta",
                  })
                  .select("id")
                  .single();

          if (error) throw error;
                setSucesso(data.id.slice(0, 8).toUpperCase());
        } catch (err: unknown) {
                toast.error("Erro ao enviar solicitacao");
        } finally {
                setLoading(false);
        }
  }

  if (sucesso) {
        return (
                <ProtectedRoute roles={["motorista"]}>
                          <AppShell title="Solicitacao Enviada">
                                    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] gap-4">
                                                <CheckCircle2 size={80} className="text-green-500" />
                                                <h2 className="text-2xl font-bold">Solicitacao enviada!</h2>
                                                <p className="text-muted-foreground">Numero da solicitacao:</p>
                                                <p className="text-4xl font-mono font-bold bg-muted rounded-xl px-6 py-3">
                                                              #{sucesso}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                              O gestor foi notificado e ira analisar seu chamado.
                                                </p>
                                                <Button
                                                                className="mt-4 w-full"
                                                                onClick={() => { setSucesso(null); setTipo(""); setDescricao(""); setUrgencia("normal"); }}
                                                              >
                                                              Nova Solicitacao
                                                </Button>
                                    </div>
                          </AppShell>
                </ProtectedRoute>
              );
  }
  
    return (
          <ProtectedRoute roles={["motorista"]}>
                <AppShell title="Solicitar Manutencao">
                        <form onSubmit={handleSubmit} className="p-4 space-y-5 pb-24">
                                  <div>
                                              <Label className="font-semibold">Tipo do Problema *</Label>
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
                                              <Label className="font-semibold">Descricao *</Label>
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
                                              <Label className="font-semibold">Urgencia</Label>
                                              <div className="grid grid-cols-2 gap-3 mt-2">
                                                {URGENCIAS.map((u) => (
                            <button
                                                key={u.value}
                                                type="button"
                                                onClick={() => setUrgencia(u.value)}
                                                className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                                                                      urgencia === u.value
                                                                        ? u.color + " border-2"
                                                                        : "bg-muted border-transparent text-muted-foreground"
                                                }`}
                                              >
                              {u.emoji} {u.label}
                            </button>
                          ))}
                                              </div>
                                  </div>
                        
                                  <div>
                                              <Label className="font-semibold">Fotos (opcional)</Label>
                                              <div className="grid grid-cols-2 gap-3 mt-2">
                                                {[0, 1, 2, 3].map((idx) => (
                            <CameraInput
                                                key={idx}
                                                label={`Foto ${idx + 1}`}
                                                onChange={(f) => setFoto(idx, f)}
                                              />
                          ))}
                                              </div>
                                  </div>
                        
                                  <Button type="submit" className="w-full h-14 text-lg font-bold" disabled={loading}>
                                    {loading ? "Enviando..." : "Enviar Solicitacao"}
                                  </Button>
                        </form>
                </AppShell>
          </ProtectedRoute>
        );
}</AppShell>
