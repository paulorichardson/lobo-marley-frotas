// Gera HTML imprimível do laudo de vistoria e abre em nova janela para impressão/PDF.
export type LaudoPDFData = {
  numero: string;
  tipo: string;
  data: string;
  local?: string | null;
  km?: number | null;
  empresa_nome?: string | null;
  vistoriador_nome?: string | null;
  responsavel_nome?: string | null;
  responsavel_documento?: string | null;
  veiculo: { placa: string; marca: string; modelo: string; cor?: string | null; chassi?: string | null; renavam?: string | null };
  checklist: Record<string, "ok" | "atencao" | "problema" | "na">;
  avarias: Array<{ lado: string; tipo: string; descricao?: string; severidade: string }>;
  fotos: Array<{ legenda: string; url: string }>;
  observacoes?: string | null;
  assinatura_vistoriador_url?: string | null;
  assinatura_responsavel_url?: string | null;
};

const ICON: Record<string, string> = { ok: "✓", atencao: "!", problema: "✗", na: "—" };
const COR: Record<string, string> = { ok: "#16a34a", atencao: "#ca8a04", problema: "#dc2626", na: "#888" };

export function imprimirLaudo(d: LaudoPDFData) {
  const checklist = Object.entries(d.checklist)
    .map(
      ([k, v]) =>
        `<tr><td>${k}</td><td style="text-align:center;color:${COR[v]};font-weight:bold">${ICON[v] ?? "—"}</td></tr>`,
    )
    .join("");

  const avarias = d.avarias.length
    ? d.avarias
        .map(
          (a) =>
            `<tr><td>${a.lado}</td><td>${a.tipo}</td><td>${a.severidade}</td><td>${a.descricao ?? ""}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#666">Nenhuma avaria registrada</td></tr>`;

  const fotos = d.fotos.length
    ? d.fotos
        .map(
          (f) =>
            `<div class="foto"><img src="${f.url}" /><div class="legenda">${f.legenda}</div></div>`,
        )
        .join("")
    : `<div style="color:#666">Sem fotos.</div>`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Laudo ${d.numero}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, sans-serif; color: #000; font-size: 11px; margin: 0; }
  .doc { max-width: 760px; margin: 0 auto; }
  h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .sub { font-size: 12px; margin-top: 2px; }
  .box { border: 1px solid #000; padding: 6px 9px; margin-bottom: 8px; }
  .box h3 { margin: 0 0 5px; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #999; padding-bottom: 3px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; font-size: 10px; }
  th { background: #eee; }
  .fotos { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 4px; }
  .foto { border: 1px solid #ccc; padding: 3px; text-align: center; }
  .foto img { width: 100%; height: 120px; object-fit: cover; }
  .legenda { font-size: 9px; color: #555; margin-top: 2px; }
  .signs { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .sign { text-align: center; }
  .sign img { max-height: 70px; }
  .sign .linha { border-top: 1px solid #000; margin-top: 4px; padding-top: 3px; font-size: 10px; }
  .footer { margin-top: 18px; text-align: center; font-size: 9px; color: #666; }
  @media print { .no-print { display:none } }
</style></head><body><div class="doc">
  <div class="header">
    <h1>LOBO MARLEY — GESTÃO DE FROTAS</h1>
    <div class="sub">LAUDO DE VISTORIA Nº <strong>${d.numero}</strong> · ${d.tipo.toUpperCase()}</div>
    <div class="sub">${new Date(d.data).toLocaleString("pt-BR")} ${d.local ? "· " + d.local : ""}</div>
  </div>

  <div class="box"><h3>Veículo</h3>
    <div class="grid3">
      <div><strong>Placa:</strong> ${d.veiculo.placa}</div>
      <div><strong>Marca/Modelo:</strong> ${d.veiculo.marca} ${d.veiculo.modelo}</div>
      <div><strong>Cor:</strong> ${d.veiculo.cor ?? "—"}</div>
      <div><strong>Chassi:</strong> ${d.veiculo.chassi ?? "—"}</div>
      <div><strong>RENAVAM:</strong> ${d.veiculo.renavam ?? "—"}</div>
      <div><strong>KM:</strong> ${d.km ?? "—"}</div>
    </div>
  </div>

  <div class="box"><h3>Partes / Responsáveis</h3>
    <div class="grid2">
      <div><strong>Empresa:</strong> ${d.empresa_nome ?? "—"}</div>
      <div><strong>Vistoriador:</strong> ${d.vistoriador_nome ?? "—"}</div>
      <div><strong>Responsável presente:</strong> ${d.responsavel_nome ?? "—"}</div>
      <div><strong>Documento:</strong> ${d.responsavel_documento ?? "—"}</div>
    </div>
  </div>

  <div class="box"><h3>Checklist</h3>
    <table><thead><tr><th>Item</th><th style="width:60px;text-align:center">Estado</th></tr></thead>
      <tbody>${checklist}</tbody></table>
    <div style="margin-top:4px;font-size:9px;color:#555">✓ OK · ! Atenção · ✗ Problema · — N/A</div>
  </div>

  <div class="box"><h3>Avarias</h3>
    <table><thead><tr><th>Lado</th><th>Tipo</th><th>Severidade</th><th>Descrição</th></tr></thead>
      <tbody>${avarias}</tbody></table>
  </div>

  <div class="box"><h3>Fotos</h3><div class="fotos">${fotos}</div></div>

  ${d.observacoes ? `<div class="box"><h3>Observações</h3><div>${d.observacoes.replace(/\n/g, "<br/>")}</div></div>` : ""}

  <div class="signs">
    <div class="sign">
      ${d.assinatura_vistoriador_url ? `<img src="${d.assinatura_vistoriador_url}" />` : "<div style='height:70px'></div>"}
      <div class="linha">${d.vistoriador_nome ?? "Vistoriador"}</div>
    </div>
    <div class="sign">
      ${d.assinatura_responsavel_url ? `<img src="${d.assinatura_responsavel_url}" />` : "<div style='height:70px'></div>"}
      <div class="linha">${d.responsavel_nome ?? "Responsável"}</div>
    </div>
  </div>

  <div class="footer">Documento gerado eletronicamente em ${new Date().toLocaleString("pt-BR")} · Lobo Marley</div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
