import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

type Alerta = {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  tipo: "Licenciamento" | "IPVA" | "Seguro";
  data: string;
  dias: number;
};

export function AlertasVencimento() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  useEffect(() => {
    (async () => {
      const limite = new Date();
      limite.setDate(limite.getDate() + 60);
      const limiteStr = limite.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("veiculos")
        .select("id, placa, marca, modelo, vencimento_licenciamento, vencimento_ipva, vencimento_seguro")
        .or(`vencimento_licenciamento.lte.${limiteStr},vencimento_ipva.lte.${limiteStr},vencimento_seguro.lte.${limiteStr}`);

      const hoje = new Date();
      const out: Alerta[] = [];
      (data ?? []).forEach((v: any) => {
        ([
          ["Licenciamento", v.vencimento_licenciamento],
          ["IPVA", v.vencimento_ipva],
          ["Seguro", v.vencimento_seguro],
        ] as const).forEach(([tipo, data]) => {
          if (!data) return;
          const d = new Date(data + "T00:00:00");
          const dias = Math.floor((d.getTime() - hoje.getTime()) / 86400000);
          if (dias <= 60) {
            out.push({ id: v.id, placa: v.placa, modelo: v.modelo, marca: v.marca, tipo, data, dias });
          }
        });
      });
      out.sort((a, b) => a.dias - b.dias);
      setAlertas(out);
    })();
  }, []);

  if (alertas.length === 0) return null;

  const vencidos = alertas.filter((a) => a.dias < 0);
  const proximos = alertas.filter((a) => a.dias >= 0 && a.dias <= 30);
  const futuros = alertas.filter((a) => a.dias > 30);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-warning" />
        <h2 className="font-semibold">Alertas de vencimento de documentos</h2>
        <Badge variant="secondary" className="ml-auto">{alertas.length}</Badge>
      </div>

      {vencidos.length > 0 && <Grupo cor="🔴" titulo={`Vencidos (${vencidos.length})`} itens={vencidos} className="border-destructive/40 bg-destructive/5" />}
      {proximos.length > 0 && <Grupo cor="🟡" titulo={`Próximos 30 dias (${proximos.length})`} itens={proximos} className="border-warning/40 bg-warning/5" />}
      {futuros.length > 0 && <Grupo cor="🔵" titulo={`31-60 dias (${futuros.length})`} itens={futuros} className="border-primary/30 bg-primary/5" />}
    </Card>
  );
}

function Grupo({ cor, titulo, itens, className }: { cor: string; titulo: string; itens: Alerta[]; className: string }) {
  return (
    <div className={`rounded border p-2 ${className}`}>
      <p className="text-sm font-medium mb-2">{cor} {titulo}</p>
      <div className="space-y-1 max-h-48 overflow-auto">
        {itens.map((a, i) => (
          <Link
            key={`${a.id}-${a.tipo}-${i}`}
            to="/gestor/veiculos/$veiculoId"
            params={{ veiculoId: a.id }}
            className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-background/60"
          >
            <span className="font-mono font-bold">{a.placa}</span>
            <span className="text-muted-foreground truncate flex-1 ml-2">{a.marca} {a.modelo}</span>
            <Badge variant="outline" className="ml-2">{a.tipo}</Badge>
            <span className="ml-2 text-muted-foreground tabular-nums">
              {new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR")}
              {a.dias < 0 ? ` (${Math.abs(a.dias)}d atrás)` : ` (${a.dias}d)`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
