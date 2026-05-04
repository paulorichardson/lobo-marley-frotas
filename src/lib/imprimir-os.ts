type OSData = {
  numero_os: string | null;
  codigo_autorizacao: string | null;
  empresa_nome?: string;
  veiculo: { placa: string; marca: string; modelo: string };
  km_na_manutencao?: number | null;
  data_solicitacao: string;
  descricao: string;
  diagnostico?: string | null;
  pecas: Array<{ descricao: string; quantidade: number; valor_unitario: number }>;
  valor_mao_obra?: number | null;
  fornecedor_nome?: string;
  aprovado_nome?: string | null;
};

const BRL = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function imprimirOS(d: OSData) {
  const totalPecas = d.pecas.reduce((s, p) => s + Number(p.quantidade) * Number(p.valor_unitario), 0);
  const total = totalPecas + Number(d.valor_mao_obra || 0);

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>OS ${d.numero_os ?? ""}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: Arial, sans-serif; color: #000; background: #fff; font-size: 12px; margin: 0; padding: 0; }
  .doc { max-width: 720px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; }
  .header h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
  .header .sub { font-size: 13px; margin-top: 4px; }
  .codes { display: flex; justify-content: space-between; font-family: monospace; font-weight: bold; margin: 8px 0; }
  .box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px; }
  .box h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #999; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { border: 1px solid #999; padding: 5px 7px; text-align: left; }
  th { background: #eee; font-size: 11px; }
  .right { text-align: right; }
  .total-row td { font-weight: bold; background: #f4f4f4; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .signs { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .sign { border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 11px; }
  .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #666; }
  @media print { .no-print { display: none; } }
</style></head><body>
<div class="doc">
  <div class="header">
    <h1>LOBO MARLEY</h1>
    <div class="sub">ORDEM DE SERVIÇO Nº <strong>${d.numero_os ?? "—"}</strong></div>
    <div class="codes">
      <span>Cód. Autorização: ${d.codigo_autorizacao ?? "—"}</span>
      <span>Emissão: ${new Date().toLocaleDateString("pt-BR")}</span>
    </div>
  </div>

  <div class="box">
    <h3>Dados</h3>
    <div class="grid2">
      <div><strong>Empresa:</strong> ${d.empresa_nome ?? "—"}</div>
      <div><strong>Fornecedor:</strong> ${d.fornecedor_nome ?? "—"}</div>
      <div><strong>Veículo:</strong> ${d.veiculo.placa} — ${d.veiculo.marca} ${d.veiculo.modelo}</div>
      <div><strong>KM:</strong> ${d.km_na_manutencao ? Number(d.km_na_manutencao).toLocaleString("pt-BR") : "—"}</div>
      <div><strong>Data solicitação:</strong> ${new Date(d.data_solicitacao).toLocaleDateString("pt-BR")}</div>
      <div><strong>Autorizado por:</strong> ${d.aprovado_nome ?? "—"}</div>
    </div>
  </div>

  <div class="box">
    <h3>Serviço solicitado</h3>
    <div>${escape(d.descricao)}</div>
    ${d.diagnostico ? `<div style="margin-top:6px"><strong>Diagnóstico:</strong> ${escape(d.diagnostico)}</div>` : ""}
  </div>

  <div class="box">
    <h3>Peças e serviços</h3>
    <table>
      <thead><tr><th>Item</th><th>Qtd</th><th class="right">Unit.</th><th class="right">Total</th></tr></thead>
      <tbody>
        ${d.pecas.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:#777">Sem peças</td></tr>` : d.pecas.map((p) => `
          <tr>
            <td>${escape(p.descricao)}</td>
            <td>${p.quantidade}</td>
            <td class="right">${BRL(p.valor_unitario)}</td>
            <td class="right">${BRL(p.quantidade * p.valor_unitario)}</td>
          </tr>`).join("")}
        <tr><td colspan="3" class="right">Subtotal peças</td><td class="right">${BRL(totalPecas)}</td></tr>
        <tr><td colspan="3" class="right">Mão de obra</td><td class="right">${BRL(Number(d.valor_mao_obra || 0))}</td></tr>
        <tr class="total-row"><td colspan="3" class="right">TOTAL</td><td class="right">${BRL(total)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="signs">
    <div class="sign">Assinatura do Gestor / Autorizador</div>
    <div class="sign">Assinatura do Fornecedor</div>
  </div>

  <div class="footer">Lobo Marley · Sistema de Gestão de Frotas · ${new Date().toLocaleString("pt-BR")}</div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function escape(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
