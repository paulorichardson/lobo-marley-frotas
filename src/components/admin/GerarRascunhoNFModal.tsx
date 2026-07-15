import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, FileText, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string;
  empresaNome: string;
  empresaCnpj: string | null;
}

interface Unidade {
  id: string;
  nome: string;
  cnpj: string | null;
  tipo: string;
  sigla: string | null;
}

interface Grupo {
  key: string;
  tomador_nome: string;
  tomador_cnpj: string | null;
  secretaria_referencia: string; // texto no template ex.: "Secretaria Municipal de Saúde"
  placas: string[];
  os_ids: string[];
  os_numeros: string[];
  valor_total: number;
}

// Configuração fixa do prestador (Lobo Marley)
const PRESTADOR = {
  razao: "LOBO MARLEY COMERCIO E SERVIÇOS EIRELI-ME",
  cnpj: "26.743.714/0001-83",
};

// Referências contratuais padrão (ATA)
const ATA_TEXTO =
  'Termo de Referência (Anexo I) do Edital do Pregão Eletrônico No 013/2024 SRP e Ata de Registro de Preços No 17/2024, vinculada ao Processo Administrativo No 067/2024';

const DADOS_PAGAMENTO =
  "DADOS PARA PAGAMENTO: Banco: 756 - (SICOOB) Banco Cooperativo do Brasil S.A  Ag: 3226  CC: 320.407-3";

const PERCENTUAL_COMISSAO = 0.03;

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPlaca(p: string) {
  const s = (p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length === 7) return `${s.slice(0, 3)}-${s.slice(3)}`;
  return p;
}

// Deduz "Secretaria Municipal de X" a partir do nome do fundo/unidade
function inferSecretaria(unidadeNome: string, tipo: string): string {
  const n = unidadeNome.toUpperCase();
  if (n.includes("SAUDE") || n.includes("SAÚDE")) return "Secretaria Municipal de Saúde";
  if (n.includes("EDUCA")) return "Secretaria Municipal de Educação";
  if (n.includes("ASSIST")) return "Secretaria Municipal de Assistência Social";
  if (n.includes("OBRAS")) return "Secretaria Municipal de Obras";
  if (n.includes("INFRA")) return "Secretaria Municipal de Infraestrutura";
  if (tipo === "fundo") return unidadeNome;
  return unidadeNome;
}

export function GerarRascunhoNFModal({ open, onOpenChange, empresaId, empresaNome, empresaCnpj }: Props) {
  const hoje = new Date();
  const [mes, setMes] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );
  const [loading, setLoading] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function gerar() {
    setLoading(true);
    setGrupos([]);
    try {
      const [ano, mm] = mes.split("-").map(Number);
      const inicio = new Date(ano, mm - 1, 1).toISOString();
      const fim = new Date(ano, mm, 1).toISOString();

      // 1) unidades da empresa
      const { data: unidades } = await supabase
        .from("unidades")
        .select("id, nome, cnpj, tipo, sigla")
        .eq("empresa_id", empresaId)
        .eq("ativo", true);

      const unidadesMap = new Map<string, Unidade>();
      (unidades ?? []).forEach((u: any) => unidadesMap.set(u.id, u));

      // 2) manutenções concluídas do período
      const { data: manuts, error } = await supabase
        .from("manutencoes")
        .select(`
          id, numero_os, valor_final, valor_liquido_faturavel, data_conclusao,
          veiculo:veiculos!inner ( id, placa, unidade_id )
        `)
        .eq("empresa_id", empresaId)
        .in("status", ["Concluída", "Faturamento"])
        .gte("data_conclusao", inicio)
        .lt("data_conclusao", fim);

      if (error) throw error;

      // 3) agrupar por unidade (ou Prefeitura para nulos)
      const grp = new Map<string, Grupo>();
      for (const m of manuts ?? []) {
        const v: any = m.veiculo;
        if (!v) continue;
        const uid = v.unidade_id;
        const unidade = uid ? unidadesMap.get(uid) : null;

        const key = unidade?.id ?? "__prefeitura__";
        const tomadorNome = unidade?.nome ?? empresaNome;
        const tomadorCnpj = unidade?.cnpj ?? empresaCnpj;
        const secretariaRef = unidade
          ? inferSecretaria(unidade.nome, unidade.tipo)
          : empresaNome;

        let g = grp.get(key);
        if (!g) {
          g = {
            key,
            tomador_nome: tomadorNome,
            tomador_cnpj: tomadorCnpj,
            secretaria_referencia: secretariaRef,
            placas: [],
            os_ids: [],
            os_numeros: [],
            valor_total: 0,
          };
          grp.set(key, g);
        }
        const placaFmt = formatPlaca(v.placa);
        if (!g.placas.includes(placaFmt)) g.placas.push(placaFmt);
        g.os_ids.push(m.id);
        if (m.numero_os) g.os_numeros.push(m.numero_os);
        g.valor_total += Number(m.valor_liquido_faturavel ?? m.valor_final ?? 0);
      }

      const arr = Array.from(grp.values()).sort((a, b) => a.tomador_nome.localeCompare(b.tomador_nome));
      setGrupos(arr);
      if (arr.length === 0) toast.info("Nenhuma OS concluída no período");
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function gerarTexto(g: Grupo): string {
    const total = g.valor_total;
    const comissao = total * PERCENTUAL_COMISSAO;
    const veiculos = g.placas.join(", ");

    return `Prestação de serviços de manutenção corretiva e preventiva de veículos, incluindo fornecimento de peças completas e outros serviços, conforme especificações constantes no ${ATA_TEXTO} da ${g.secretaria_referencia} de Tremedal - BA."
Veículos atendidos: ${veiculos}.
Base de cálculo conforme Art. 18 da IN RFB no 2.145/2023: Valor total dos serviços (base): R$ ${fmtBRL(total)} "Valor da comissão (3%): R$ ${fmtBRL(comissao)}. Conforme o §1o do Art. 18, destaca-se que a base de cálculo para retenção dos tributos federais corresponde ao valor da comissão acima indicada. Não há retenção de ISS sobre a comissão destacada, conforme entendimento vigente sobre a não incidência de ISS em operações de intermediação sem cobrança de comissão específica.
${DADOS_PAGAMENTO}`;
  }

  function copiar(g: Grupo) {
    const texto = gerarTexto(g);
    navigator.clipboard.writeText(texto);
    setCopiado(g.key);
    toast.success("Discriminação copiada — cole no portal da NFS-e");
    setTimeout(() => setCopiado(null), 2500);
  }

  function copiarCabecalho(g: Grupo) {
    const cnpj = g.tomador_cnpj ?? "";
    const bloco = `TOMADOR
Razão social: ${g.tomador_nome}
CNPJ: ${cnpj}
Valor total do serviço: R$ ${fmtBRL(g.valor_total)}
ISS (5%): R$ ${fmtBRL(g.valor_total * 0.05)}`;
    navigator.clipboard.writeText(bloco);
    toast.success("Dados do tomador copiados");
  }

  const totalGeral = useMemo(() => grupos.reduce((s, g) => s + g.valor_total, 0), [grupos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Rascunho de Notas Fiscais — {empresaNome}
          </DialogTitle>
        </DialogHeader>

        <Card className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Período (mês)</Label>
            <Input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-40"
            />
          </div>
          <Button onClick={gerar} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Gerar rascunhos
          </Button>
          <div className="ml-auto text-sm text-muted-foreground space-y-0.5 text-right">
            <div>Prestador fixo: <span className="font-mono">{PRESTADOR.cnpj}</span></div>
            <div>{PRESTADOR.razao}</div>
          </div>
        </Card>

        {grupos.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{grupos.length} nota(s)</Badge>
            <Badge variant="outline">
              Total do período: R$ {fmtBRL(totalGeral)}
            </Badge>
          </div>
        )}

        <div className="space-y-4">
          {grupos.map((g) => (
            <Card key={g.key} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{g.tomador_nome}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    CNPJ: {g.tomador_cnpj ?? "— (informar no portal)"}
                  </div>
                  <div className="text-xs mt-1">
                    {g.os_ids.length} OS · {g.placas.length} veículo(s) ·{" "}
                    <span className="font-semibold text-foreground">R$ {fmtBRL(g.valor_total)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copiarCabecalho(g)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copiar tomador
                  </Button>
                  <Button size="sm" onClick={() => copiar(g)}>
                    {copiado === g.key
                      ? <Check className="w-3.5 h-3.5 mr-1" />
                      : <Copy className="w-3.5 h-3.5 mr-1" />}
                    Copiar discriminação
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {g.placas.map((p) => (
                  <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>
                ))}
              </div>

              <Textarea
                readOnly
                className="font-mono text-xs h-56"
                value={gerarTexto(g)}
              />

              {g.os_numeros.length > 0 && (
                <div className="text-[10px] text-muted-foreground">
                  OS incluídas: {g.os_numeros.join(", ")}
                </div>
              )}
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
