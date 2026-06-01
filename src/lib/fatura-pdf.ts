type Item = {
  data: string;
  numero_os: string | null;
  veiculo: string;
  oficina: string;
  descricao: string;
  valor: number;
};

type FaturaData = {
  numero_fatura?: string | null;
  numero_nf?: string | null;
  serie_nf?: string | null;
  data_emissao?: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  empresa: {
    nome: string;
    cnpj?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
  };
  prestador?: {
    nome: string;
    cnpj?: string | null;
    endereco?: string | null;
  };
  itens: Item[];
  valor_servicos: number;
  valor_pecas?: number;
  valor_abastecimentos?: number;
  valor_despesas?: number;
  taxa_gestao_percentual?: number | null;
  valor_taxa?: number | null;
  valor_total: number;
  observacoes?: string | null;
  tipo: "fatura" | "nf";
};

const BRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );

export function imprimirFatura(d: FaturaData) {
  const titulo = d.tipo === "nf" ? "NOTA FISCAL DE SERVIÇO" : "FATURA DE SERVIÇOS";
  const numeroExibido =
    d.tipo === "nf"
      ? `${d.numero_nf ?? "—"}${d.serie_nf ? ` · Série ${d.serie_nf}` : ""}`
      : (d.numero_fatura ?? "—");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} ${esc(numeroExibido)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, sans-serif; color: #000; background: #fff; font-size: 11px; margin: 0; }
  .doc { max-width: 760px; margin: 0 auto; }
  .header { border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 14px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .brand h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
  .brand p { margin: 2px 0 0; font-size: 11px; }
  .doc-num { text-align:right; font-family: monospace; }
  .doc-num h2 { margin:0; font-size: 14px; letter-spacing:1px; }
  .doc-num .num { font-size: 18px; font-weight:bold; margin-top:4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .box { border: 1px solid #000; padding: 8px 10px; }
  .box h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #999; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #999; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #eee; font-size: 10px; text-transform: uppercase; }
  .right { text-align: right; font-family: monospace; }
  .tot td { font-weight: bold; background: #f4f4f4; }
  .totals { margin-top: 10px; width: 320px; margin-left:auto; border-collapse:collapse; }
  .totals td { border: 1px solid #999; padding: 5px 8px; }
  .totals .grand { background:#000; color:#fff; font-size:13px; }
  .signs { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sign { border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 10px; }
  .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #666; }
  .obs { margin-top: 10px; font-size: 10px; padding: 6px 8px; background:#fafafa; border:1px dashed #aaa; }
</style></head><body>
<div class="doc">
  <div class="header">
    <div class="brand">
      <h1>LOBO MARLEY</h1>
      <p>Gestão e Manutenção de Frotas · CNPJ 51.500.000/0001-00</p>
      <p>Tremedal/BA · contato@lobomarley.online</p>
    </div>
    <div class="doc-num">
      <h2>${esc(titulo)}</h2>
      <div class="num">${esc(numeroExibido)}</div>
      <div style="margin-top:4px">Emissão: ${esc(new Date(d.data_emissao || new Date()).toLocaleDateString("pt-BR"))}</div>
      <div>Competência: ${esc(formatDate(d.periodo_inicio))} a ${esc(formatDate(d.periodo_fim))}</div>
    </div>
  </div>

  <div class="grid2">
    <div class="box">
      <h3>Tomador (Cliente)</h3>
      <div><strong>${esc(d.empresa.nome)}</strong></div>
      ${d.empresa.cnpj ? `<div>CNPJ: ${esc(d.empresa.cnpj)}</div>` : ""}
      ${d.empresa.endereco ? `<div>${esc(d.empresa.endereco)}</div>` : ""}
      ${(d.empresa.cidade || d.empresa.estado) ? `<div>${esc(d.empresa.cidade ?? "")}/${esc(d.empresa.estado ?? "")}</div>` : ""}
    </div>
    <div class="box">
      <h3>Prestador</h3>
      <div><strong>${esc(d.prestador?.nome ?? "LOBO MARLEY COMÉRCIO E SERVIÇOS LTDA")}</strong></div>
      ${d.prestador?.cnpj ? `<div>CNPJ: ${esc(d.prestador.cnpj)}</div>` : ""}
      ${d.prestador?.endereco ? `<div>${esc(d.prestador.endereco)}</div>` : ""}
    </div>
  </div>

  <div class="box">
    <h3>Discriminação dos serviços</h3>
    <table>
      <thead><tr>
        <th style="width:70px">Data</th>
        <th style="width:90px">OS</th>
        <th style="width:90px">Veículo</th>
        <th>Oficina / Descrição</th>
        <th class="right" style="width:90px">Valor</th>
      </tr></thead>
      <tbody>
        ${
          d.itens.length === 0
            ? `<tr><td colspan="5" style="text-align:center;color:#777;padding:14px">Sem lançamentos no período</td></tr>`
            : d.itens
                .map(
                  (i) => `
            <tr>
              <td>${esc(formatDate(i.data))}</td>
              <td>${esc(i.numero_os ?? "—")}</td>
              <td>${esc(i.veiculo)}</td>
              <td><strong>${esc(i.oficina)}</strong><br><span style="color:#444">${esc(i.descricao)}</span></td>
              <td class="right">${BRL(i.valor)}</td>
            </tr>`,
                )
                .join("")
        }
      </tbody>
    </table>
  </div>

  <table class="totals">
    ${d.valor_pecas != null ? `<tr><td>Peças/Serviços</td><td class="right">${BRL(d.valor_servicos + (d.valor_pecas || 0))}</td></tr>` : `<tr><td>Serviços (OSs)</td><td class="right">${BRL(d.valor_servicos)}</td></tr>`}
    ${d.valor_abastecimentos ? `<tr><td>Abastecimentos</td><td class="right">${BRL(d.valor_abastecimentos)}</td></tr>` : ""}
    ${d.valor_despesas ? `<tr><td>Despesas</td><td class="right">${BRL(d.valor_despesas)}</td></tr>` : ""}
    ${d.taxa_gestao_percentual ? `<tr><td>Taxa de gestão (${Number(d.taxa_gestao_percentual).toFixed(2)}%)</td><td class="right">${BRL(d.valor_taxa ?? 0)}</td></tr>` : ""}
    <tr class="grand"><td>TOTAL ${d.tipo === "nf" ? "DA NF" : "DA FATURA"}</td><td class="right">${BRL(d.valor_total)}</td></tr>
  </table>

  ${d.observacoes ? `<div class="obs"><strong>Observações:</strong> ${esc(d.observacoes)}</div>` : ""}

  <div class="signs">
    <div class="sign">Lobo Marley — Emitente</div>
    <div class="sign">${esc(d.empresa.nome)} — Recebido em ___/___/______</div>
  </div>

  <div class="footer">${esc(titulo)} ${esc(numeroExibido)} · Documento gerado em ${esc(new Date().toLocaleString("pt-BR"))} · Lobo Marley</div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body></html>`;

  const w = window.open("", "_blank", "width=920,height=720");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function formatDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
}
