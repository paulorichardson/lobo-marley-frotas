import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import {
  useAbastecimentos,
  useManutencoes,
  useChecklists,
} from "@/hooks/useChecklists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fuel, Wrench, ClipboardCheck, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/relatorios")({
  component: () => (
    <ProtectedRoute roles={["admin"]}>
      <AppShell>
        <RelatoriosPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

function RelatoriosPage() {
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString().slice(0, 10);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    .toISOString().slice(0, 10);

  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(ultimoDia);

  const { abastecimentos, isLoading: loadAb } = useAbastecimentos(dataInicio, dataFim);
  const { manutencoes, isLoading: loadMan } = useManutencoes();
  const { checklists, isLoading: loadCheck } = useChecklists();

  const totalAbastecimentos = abastecimentos.reduce(
    (acc, a) => acc + (Number(a.valor_total) || 0),
    0,
  );
  const totalManutencoes = manutencoes.reduce(
    (acc, m) => acc + (Number(m.valor_final) || Number(m.valor_previsto) || 0),
    0,
  );
  const totalLitros = abastecimentos.reduce(
    (acc, a) => acc + (Number(a.litros) || 0),
    0,
  );

  function exportarPDF() {
    window.print();
  }

  return (
    <div className="p-6 space-y-6 print:p-2">
      <div className="flex flex-wrap items-end gap-4 no-print">
        <div>
          <Label>Data início</Label>
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Data fim</Label>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button onClick={exportarPDF} variant="outline" className="gap-2">
          <Printer size={16} /> Exportar PDF
        </Button>
      </div>

      <div className="print:block">
        <h2 className="text-xl font-bold mb-1 hidden print:block">
          Relatório de frotas
        </h2>
        <p className="text-sm text-muted-foreground hidden print:block mb-4">
          Período: {format(new Date(dataInicio + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })} a{" "}
          {format(new Date(dataFim + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Fuel size={18} className="text-blue-500" /> Abastecimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadAb ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  R$ {totalAbastecimentos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {abastecimentos.length} registros | {totalLitros.toFixed(0)} litros
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench size={18} className="text-orange-500" /> Manutenções
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadMan ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  R$ {totalManutencoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {manutencoes.length} ordens de serviço
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck size={18} className="text-green-500" /> Checklists
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadCheck ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold">{checklists.length}</p>
                <p className="text-sm text-muted-foreground">checklists realizados</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel size={18} className="text-blue-500" />
            Detalhamento de abastecimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadAb ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : abastecimentos.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum abastecimento no período selecionado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Data</th>
                    <th className="text-left py-2 pr-4">Veículo</th>
                    <th className="text-left py-2 pr-4">Motorista</th>
                    <th className="text-left py-2 pr-4">Litros</th>
                    <th className="text-left py-2 pr-4">Combustível</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {abastecimentos.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {a.data_hora
                          ? format(new Date(a.data_hora), "dd/MM/yy", { locale: ptBR })
                          : "-"}
                      </td>
                      <td className="py-2 pr-4">
                        {(a.veiculos as { placa?: string } | null)?.placa ?? "-"}
                      </td>
                      <td className="py-2 pr-4">
                        {(a.perfis as { nome?: string } | null)?.nome ?? "-"}
                      </td>
                      <td className="py-2 pr-4">{a.litros}L</td>
                      <td className="py-2 pr-4">{a.combustivel ?? "-"}</td>
                      <td className="py-2 text-right font-semibold">
                        R$ {Number(a.valor_total ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td colSpan={5} className="py-2 pr-4">Total</td>
                    <td className="py-2 text-right">
                      R$ {totalAbastecimentos.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
