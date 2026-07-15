import logoAsset from "@/assets/lobo-marley-logo.png.asset.json";

const LOGO_URL = typeof window !== "undefined" ? new URL(logoAsset.url, window.location.origin).href : logoAsset.url;

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
  data_vencimento?: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  empresa: {
    nome: string;
    cnpj?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
    responsavel?: string | null;
    contato?: string | null;
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
  descontos?: number;
  acrescimos?: number;
  taxa_gestao_percentual?: number | null;
  valor_taxa?: number | null;
  valor_total: number;
  observacoes?: string | null;
  tipo: "fatura" | "nf";
  setor?: string | null;
  status?: "aberta" | "paga" | "vencida" | string | null;
};

const BRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );

// CNPJs dos fundos municipais — Ipupiara/BA
// Quando a fatura é destinada a uma secretaria/fundo específico,
// o CNPJ do Tomador é substituído pelo CNPJ do fundo correspondente.
const CNPJ_FUNDOS_IPUPIARA: Record<string, { cnpj: string; razao: string }> = {
  "EDUCACAO": { cnpj: "06.077.123/0001-07", razao: "FUNDO MUNICIPAL DE EDUCAÇÃO DE IPUPIARA" },
  "FUNDO MUNICIPAL DE EDUCACAO": { cnpj: "06.077.123/0001-07", razao: "FUNDO MUNICIPAL DE EDUCAÇÃO DE IPUPIARA" },
  "SECRETARIA DE EDUCACAO": { cnpj: "63.703.974/0001-51", razao: "SECRETARIA MUNICIPAL DE EDUCAÇÃO DE IPUPIARA" },
  "SAUDE": { cnpj: "12.211.436/0001-09", razao: "FUNDO MUNICIPAL DE SAÚDE DE IPUPIARA" },
  "FUNDO MUNICIPAL DE SAUDE": { cnpj: "12.211.436/0001-09", razao: "FUNDO MUNICIPAL DE SAÚDE DE IPUPIARA" },
  "SAMU": { cnpj: "12.211.436/0001-09", razao: "FUNDO MUNICIPAL DE SAÚDE DE IPUPIARA" },
  "SAMU 192": { cnpj: "12.211.436/0001-09", razao: "FUNDO MUNICIPAL DE SAÚDE DE IPUPIARA" },
  "ASSISTENCIA SOCIAL": { cnpj: "18.122.924/0001-26", razao: "FUNDO MUNICIPAL DE ASSISTÊNCIA SOCIAL DE IPUPIARA" },
  "FUNDO MUNICIPAL DE ASSISTENCIA SOCIAL": { cnpj: "18.122.924/0001-26", razao: "FUNDO MUNICIPAL DE ASSISTÊNCIA SOCIAL DE IPUPIARA" },
  "GABINETE": { cnpj: "13.798.384/0001-81", razao: "PREFEITURA MUNICIPAL DE IPUPIARA" },
  "GABINETE DO PREFEITO": { cnpj: "13.798.384/0001-81", razao: "PREFEITURA MUNICIPAL DE IPUPIARA" },
  "OBRAS": { cnpj: "13.798.384/0001-81", razao: "PREFEITURA MUNICIPAL DE IPUPIARA" },
  "ADMINISTRACAO": { cnpj: "13.798.384/0001-81", razao: "PREFEITURA MUNICIPAL DE IPUPIARA" },
};

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function resolverTomador(empresa: FaturaData["empresa"], setor?: string | null) {
  const cidade = normalizar(empresa.cidade ?? "");
  if (cidade === "IPUPIARA" && setor) {
    const key = normalizar(setor);
    const fundo = CNPJ_FUNDOS_IPUPIARA[key];
    if (fundo) {
      return { nome: fundo.razao, cnpj: fundo.cnpj };
    }
  }
  return { nome: empresa.nome, cnpj: empresa.cnpj ?? null };
}

function gerarHash(d: FaturaData) {
  const base = `${d.numero_fatura ?? d.numero_nf ?? ""}-${d.valor_total}-${d.periodo_inicio}-${d.periodo_fim}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = ((h << 5) - h + base.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(12, "0").slice(0, 16).toUpperCase();
}

function buildFaturaHTML(d: FaturaData, autoprint: boolean): string {
  const tomador = resolverTomador(d.empresa, d.setor);
  const titulo = d.tipo === "nf" ? "NOTA FISCAL DE SERVIÇO" : "FATURA CORPORATIVA";
  const numeroExibido =
    d.tipo === "nf"
      ? `${d.numero_nf ?? "—"}${d.serie_nf ? ` · Série ${d.serie_nf}` : ""}`
      : (d.numero_fatura ?? "—");

  const status = (d.status ?? "aberta").toLowerCase();
  const statusLabel =
    status === "paga" ? "PAGA" : status === "vencida" ? "VENCIDA" : "ABERTA";
  const statusColor =
    status === "paga" ? "#16a34a" : status === "vencida" ? "#DC0000" : "#0A0E27";

  // Agrupamentos
  const porVeiculo = new Map<string, { placa: string; qtd: number; total: number }>();
  const porFornecedor = new Map<string, { nome: string; qtd: number; total: number }>();
  for (const i of d.itens) {
    const v = porVeiculo.get(i.veiculo) ?? { placa: i.veiculo, qtd: 0, total: 0 };
    v.qtd++; v.total += Number(i.valor || 0);
    porVeiculo.set(i.veiculo, v);

    const f = porFornecedor.get(i.oficina) ?? { nome: i.oficina, qtd: 0, total: 0 };
    f.qtd++; f.total += Number(i.valor || 0);
    porFornecedor.set(i.oficina, f);
  }
  const veiculos = Array.from(porVeiculo.values()).sort((a, b) => b.total - a.total);
  const fornecedoresAgg = Array.from(porFornecedor.values()).sort((a, b) => b.total - a.total);

  const dataEmissao = new Date(d.data_emissao || new Date());
  const dataVenc = d.data_vencimento
    ? new Date(d.data_vencimento)
    : new Date(dataEmissao.getTime() + 15 * 24 * 60 * 60 * 1000);

  const hash = gerarHash(d);
  const codAuth = `LM-${dataEmissao.getFullYear()}-${(d.numero_fatura ?? d.numero_nf ?? "000").toString().padStart(6, "0")}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`https://www.lobomarley.online/v/${hash}`)}`;

  const subtotal = d.valor_servicos + (d.valor_pecas || 0) + (d.valor_abastecimentos || 0) + (d.valor_despesas || 0);

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} ${esc(numeroExibido)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, Arial, sans-serif; color: #0A0E27; background: #fff; font-size: 10.5px; margin: 0; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc { max-width: 820px; margin: 0 auto; }

  /* HEADER */
  .header { background: linear-gradient(135deg, #0A0E27 0%, #161d3f 100%); color:#fff; padding: 22px 26px; border-radius: 6px; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .brand { display: flex; gap: 14px; align-items: center; }
  .logo { width: 72px; height: 72px; display:flex; align-items:center; justify-content:center; }
  .logo img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 10px rgba(220,0,0,.35)); }
  .brand h1 { margin:0; font-size: 20px; font-weight: 800; letter-spacing: .5px; }
  .brand .tag { margin: 2px 0 0; font-size: 10px; color: #D9D9D9; font-weight: 500; letter-spacing: .8px; text-transform: uppercase; }
  .brand .meta { margin-top: 8px; font-size: 9.5px; color: #cbd0e0; line-height: 1.55; }
  .doc-info { text-align: right; min-width: 220px; }
  .doc-info .label { font-size: 9px; color: #8b93b3; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600; }
  .doc-info .titulo { font-size: 13px; font-weight: 700; color: #fff; margin: 2px 0 6px; letter-spacing: .5px; }
  .doc-info .num { font-family: 'Inter', monospace; font-size: 18px; font-weight: 800; color: #fff; padding: 6px 12px; background: rgba(255,255,255,.08); border-radius: 4px; display: inline-block; border-left: 3px solid #DC0000; }
  .doc-info .datas { margin-top: 10px; font-size: 9.5px; color: #cbd0e0; display: grid; grid-template-columns: auto auto; gap: 2px 12px; justify-content: end; }
  .doc-info .datas strong { color: #fff; font-weight: 600; }
  .status-badge { display: inline-block; margin-top: 10px; padding: 5px 14px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 1px; background: ${statusColor}; color: #fff; }
  .status-badge::before { content: "● "; }

  /* HERO VALOR */
  .hero-valor { margin-top: 16px; background: #fff; border: 2px solid #0A0E27; border-radius: 6px; padding: 22px 26px; display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: center; position: relative; overflow: hidden; }
  .hero-valor::before { content:""; position:absolute; left:0; top:0; bottom:0; width:6px; background: linear-gradient(180deg,#DC0000,#0A0E27); }
  .hero-valor .label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #6b7290; font-weight: 600; }
  .hero-valor .valor { font-size: 38px; font-weight: 800; color: #0A0E27; letter-spacing: -1px; margin: 4px 0; font-variant-numeric: tabular-nums; }
  .hero-valor .periodo { font-size: 10.5px; color: #6b7290; }
  .hero-valor .periodo strong { color: #0A0E27; }
  .hero-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .hero-stat { background: #f7f8fc; border-radius: 5px; padding: 10px; text-align: center; border-bottom: 2px solid #0A0E27; }
  .hero-stat .n { font-size: 18px; font-weight: 800; color: #0A0E27; font-variant-numeric: tabular-nums; }
  .hero-stat .l { font-size: 8.5px; text-transform: uppercase; letter-spacing: 1px; color: #6b7290; font-weight: 600; margin-top: 2px; }

  /* CARDS RESUMO */
  .cards4 { margin-top: 14px; display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
  .card { background: #fff; border: 1px solid #e3e6ee; border-radius: 6px; padding: 12px 14px; border-left: 3px solid #0A0E27; }
  .card .l { font-size: 8.5px; text-transform: uppercase; letter-spacing: 1px; color: #8a90a8; font-weight: 600; }
  .card .v { font-size: 15px; font-weight: 700; color: #0A0E27; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .card.accent { border-left-color: #DC0000; }

  /* SEÇÕES */
  .section { margin-top: 16px; background: #fff; border: 1px solid #e3e6ee; border-radius: 6px; overflow: hidden; }
  .section-h { background: #f7f8fc; padding: 9px 16px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #0A0E27; border-bottom: 1px solid #e3e6ee; display: flex; align-items: center; gap: 8px; }
  .section-h::before { content:""; display:inline-block; width:3px; height:12px; background:#DC0000; border-radius:2px; }
  .section-b { padding: 14px 16px; }

  .tomador-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 22px; font-size: 10.5px; }
  .tomador-grid div { padding: 3px 0; border-bottom: 1px dashed #eef0f6; }
  .tomador-grid .k { color: #6b7290; font-size: 9px; text-transform: uppercase; letter-spacing: .8px; font-weight: 600; }
  .tomador-grid .v { color: #0A0E27; font-weight: 600; margin-top: 1px; }

  .resumo-exec { font-size: 10.5px; color: #2a3055; line-height: 1.6; }

  /* TABELA */
  table.itens { width: 100%; border-collapse: collapse; }
  table.itens thead th { background: #0A0E27; color: #fff; padding: 9px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  table.itens tbody td { padding: 8px 10px; border-bottom: 1px solid #eef0f6; vertical-align: top; font-size: 10px; }
  table.itens tbody tr:nth-child(even) td { background: #fafbfd; }
  table.itens .data { white-space: nowrap; color: #6b7290; font-variant-numeric: tabular-nums; }
  table.itens .os { font-family: monospace; font-weight: 700; color: #0A0E27; }
  table.itens .placa { font-family: monospace; font-weight: 700; background: #0A0E27; color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 9px; letter-spacing: 1px; }
  table.itens .forn { font-weight: 600; color: #0A0E27; }
  table.itens .desc { color: #2a3055; }
  table.itens .valor { text-align: right; font-family: monospace; font-weight: 700; color: #0A0E27; white-space: nowrap; font-variant-numeric: tabular-nums; }

  /* AGRUPAMENTOS */
  .twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
  table.mini { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.mini th { background: #f7f8fc; color: #6b7290; padding: 7px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .8px; font-weight: 600; border-bottom: 1px solid #e3e6ee; }
  table.mini td { padding: 7px 10px; border-bottom: 1px solid #eef0f6; }
  table.mini td.r { text-align: right; font-family: monospace; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* DEMONSTRATIVO */
  .demonstrativo { margin-top: 16px; display: grid; grid-template-columns: 1fr 320px; gap: 16px; align-items: end; }
  .obs-box { background: #f7f8fc; border-left: 3px solid #D9D9D9; padding: 10px 14px; border-radius: 4px; font-size: 9.5px; color: #2a3055; }
  .obs-box strong { color: #0A0E27; }
  .totais { background: #fff; border: 1px solid #e3e6ee; border-radius: 6px; overflow: hidden; }
  .totais .row { display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #eef0f6; font-size: 10.5px; }
  .totais .row .k { color: #6b7290; }
  .totais .row .v { font-family: monospace; font-weight: 700; color: #0A0E27; font-variant-numeric: tabular-nums; }
  .totais .grand { background: #DC0000; color: #fff; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; }
  .totais .grand .k { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; }
  .totais .grand .v { font-size: 20px; font-weight: 800; font-family: 'Inter', monospace; font-variant-numeric: tabular-nums; }

  /* RODAPÉ */
  .footer { margin-top: 20px; background: #0A0E27; color: #cbd0e0; border-radius: 6px; padding: 16px 20px; display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; font-size: 9px; }
  .footer .auth { line-height: 1.6; }
  .footer .auth strong { color: #fff; }
  .footer .hash { font-family: monospace; color: #fff; background: rgba(255,255,255,.06); padding: 4px 8px; border-radius: 3px; display: inline-block; margin-top: 4px; letter-spacing: 1px; }
  .footer .qr { background: #fff; padding: 6px; border-radius: 6px; }
  .footer .qr img { display: block; width: 90px; height: 90px; }

  .pagina { text-align: center; font-size: 8.5px; color: #8a90a8; margin-top: 10px; }

  @media print {
    body { font-size: 10px; }
    .header, .hero-valor, .section, .totais, .footer { break-inside: avoid; page-break-inside: avoid; }
    table.itens thead { display: table-header-group; }
    table.itens tfoot { display: table-footer-group; }
  }
</style></head><body>
<div class="doc">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      <div class="logo"><img src="${LOGO_URL}" alt="Lobo Marley" /></div>
      <div>
        <h1>LOBO MARLEY COMÉRCIO E SERVIÇOS LTDA</h1>
        <p class="tag">Gestão Inteligente de Frotas</p>
        <div class="meta">
          CNPJ 26.743.714/0001-83<br>
          Rodovia BA 156, Km 2, nº 22 — Tanque Novo/BA · CEP 46.580-000<br>
          www.lobomarley.online · contato@lobomarley.online
        </div>
      </div>
    </div>
    <div class="doc-info">
      <div class="label">Documento</div>
      <div class="titulo">${esc(titulo)}</div>
      <div class="num">Nº ${esc(numeroExibido)}</div>
      <div class="datas">
        <span>Competência:</span><strong>${esc(formatMes(d.periodo_inicio))} a ${esc(formatMes(d.periodo_fim))}</strong>
        <span>Emissão:</span><strong>${esc(dataEmissao.toLocaleDateString("pt-BR"))}</strong>
        <span>Vencimento:</span><strong>${esc(dataVenc.toLocaleDateString("pt-BR"))}</strong>
      </div>
      <div class="status-badge">${statusLabel}</div>
    </div>
  </div>

  <!-- HERO VALOR -->
  <div class="hero-valor">
    <div>
      <div class="label">Valor Total da Fatura</div>
      <div class="valor">${BRL(d.valor_total)}</div>
      <div class="periodo">Período: <strong>${esc(formatDate(d.periodo_inicio))}</strong> até <strong>${esc(formatDate(d.periodo_fim))}</strong></div>
    </div>
    <div class="hero-stats">
      <div class="hero-stat"><div class="n">${d.itens.length}</div><div class="l">Ordens de Serviço</div></div>
      <div class="hero-stat"><div class="n">${veiculos.length}</div><div class="l">Veículos</div></div>
      <div class="hero-stat"><div class="n">${fornecedoresAgg.length}</div><div class="l">Fornecedores</div></div>
    </div>
  </div>

  <!-- CARDS RESUMO -->
  <div class="cards4">
    <div class="card accent"><div class="l">Valor Total</div><div class="v">${BRL(d.valor_total)}</div></div>
    <div class="card"><div class="l">Qtd. OS</div><div class="v">${d.itens.length}</div></div>
    <div class="card"><div class="l">Veículos</div><div class="v">${veiculos.length}</div></div>
    <div class="card"><div class="l">Período</div><div class="v" style="font-size:11px">${esc(formatDate(d.periodo_inicio))} → ${esc(formatDate(d.periodo_fim))}</div></div>
  </div>

  <!-- TOMADOR -->
  <div class="section">
    <div class="section-h">Tomador dos Serviços</div>
    <div class="section-b">
      <div class="tomador-grid">
        <div><div class="k">Razão Social</div><div class="v">${esc(tomador.nome)}</div></div>
        <div><div class="k">CNPJ</div><div class="v">${esc(tomador.cnpj ?? "—")}</div></div>
        <div><div class="k">Município</div><div class="v">${esc(d.empresa.cidade ?? "—")}/${esc(d.empresa.estado ?? "—")}</div></div>
        <div><div class="k">Secretaria / Fundo</div><div class="v">${esc(d.setor ?? "—")}</div></div>
        <div><div class="k">Responsável</div><div class="v">${esc(d.empresa.responsavel ?? "—")}</div></div>
        <div><div class="k">Contato</div><div class="v">${esc(d.empresa.contato ?? "—")}</div></div>
      </div>
    </div>
  </div>

  <!-- RESUMO EXECUTIVO -->
  <div class="section">
    <div class="section-h">Resumo Executivo</div>
    <div class="section-b resumo-exec">
      Durante o período faturado foram executadas <strong>${d.itens.length} ordens de serviço</strong>
      referentes à manutenção corretiva e preventiva da frota vinculada ao contrato${d.setor ? ` da <strong>${esc(d.setor)}</strong>` : ""}.
      Os serviços foram prestados por <strong>${fornecedoresAgg.length} fornecedor(es) credenciado(s)</strong>
      e contemplaram <strong>${veiculos.length} veículo(s)</strong> da frota, totalizando <strong>${BRL(d.valor_total)}</strong>.
    </div>
  </div>

  <!-- TABELA -->
  <div class="section">
    <div class="section-h">Discriminação dos Serviços</div>
    <table class="itens">
      <thead><tr>
        <th style="width:70px">Data</th>
        <th style="width:110px">OS</th>
        <th style="width:80px">Veículo</th>
        <th style="width:160px">Fornecedor</th>
        <th>Descrição</th>
        <th style="width:90px;text-align:right">Valor</th>
      </tr></thead>
      <tbody>
        ${
          d.itens.length === 0
            ? `<tr><td colspan="6" style="text-align:center;color:#8a90a8;padding:24px">Sem lançamentos no período</td></tr>`
            : d.itens.map((i) => `
              <tr>
                <td class="data">${esc(formatDate(i.data))}</td>
                <td><span class="os">${esc(i.numero_os ?? "—")}</span></td>
                <td><span class="placa">${esc(i.veiculo)}</span></td>
                <td class="forn">${esc(i.oficina)}</td>
                <td class="desc">${esc(i.descricao)}</td>
                <td class="valor">${BRL(i.valor)}</td>
              </tr>`).join("")
        }
      </tbody>
    </table>
  </div>

  <!-- AGRUPAMENTOS -->
  <div class="twocol">
    <div class="section" style="margin-top:0">
      <div class="section-h">Resumo por Veículo</div>
      <table class="mini">
        <thead><tr><th>Placa</th><th style="text-align:center">Qtd OS</th><th class="r" style="text-align:right">Total</th></tr></thead>
        <tbody>
          ${veiculos.map((v) => `
            <tr><td><span class="placa">${esc(v.placa)}</span></td>
            <td style="text-align:center">${v.qtd}</td>
            <td class="r">${BRL(v.total)}</td></tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="section" style="margin-top:0">
      <div class="section-h">Resumo por Fornecedor</div>
      <table class="mini">
        <thead><tr><th>Fornecedor</th><th style="text-align:center">Qtd</th><th class="r" style="text-align:right">Total</th></tr></thead>
        <tbody>
          ${fornecedoresAgg.map((f) => `
            <tr><td style="font-weight:600">${esc(f.nome)}</td>
            <td style="text-align:center">${f.qtd}</td>
            <td class="r">${BRL(f.total)}</td></tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  </div>

  <!-- DEMONSTRATIVO -->
  <div class="demonstrativo">
    <div class="obs-box">
      <strong>Observações:</strong><br>
      ${esc(d.observacoes ?? "Pagamento conforme contrato vigente. Em caso de dúvidas sobre esta fatura, entrar em contato com a Lobo Marley pelos canais oficiais.")}
    </div>
    <div class="totais">
      <div class="row"><span class="k">Subtotal de serviços</span><span class="v">${BRL(subtotal)}</span></div>
      ${d.valor_pecas ? `<div class="row"><span class="k">Peças</span><span class="v">${BRL(d.valor_pecas)}</span></div>` : ""}
      ${d.valor_abastecimentos ? `<div class="row"><span class="k">Abastecimentos</span><span class="v">${BRL(d.valor_abastecimentos)}</span></div>` : ""}
      ${d.valor_despesas ? `<div class="row"><span class="k">Despesas</span><span class="v">${BRL(d.valor_despesas)}</span></div>` : ""}
      ${d.descontos ? `<div class="row"><span class="k">Descontos</span><span class="v">- ${BRL(d.descontos)}</span></div>` : ""}
      ${d.acrescimos ? `<div class="row"><span class="k">Acréscimos</span><span class="v">${BRL(d.acrescimos)}</span></div>` : ""}
      ${d.taxa_gestao_percentual ? `<div class="row"><span class="k">Taxa de gestão (${Number(d.taxa_gestao_percentual).toFixed(2)}%)</span><span class="v">${BRL(d.valor_taxa ?? 0)}</span></div>` : ""}
      <div class="grand"><span class="k">Valor Final</span><span class="v">${BRL(d.valor_total)}</span></div>
    </div>
  </div>

  <!-- RODAPÉ -->
  <div class="footer">
    <div class="auth">
      <strong>Documento emitido eletronicamente pelo sistema Lobo Marley</strong><br>
      Código de autenticação: <strong>${esc(codAuth)}</strong><br>
      Hash de validação: <span class="hash">${esc(hash)}</span><br>
      Emitido em ${esc(dataEmissao.toLocaleString("pt-BR"))} · www.lobomarley.online
    </div>
    <div class="qr"><img src="${qrUrl}" alt="QR de conferência"></div>
  </div>

  <div class="pagina">${esc(titulo)} Nº ${esc(numeroExibido)} · Lobo Marley · Gestão Inteligente de Frotas</div>
</div>
${autoprint ? `<script>window.onload=()=>setTimeout(()=>window.print(),500);</script>` : ""}
</body></html>`;

  return html;
}

export function imprimirFatura(d: FaturaData) {
  const html = buildFaturaHTML(d, true);
  const w = window.open("", "_blank", "width=960,height=760");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export async function baixarFaturaPDF(d: FaturaData) {
  const html = buildFaturaHTML(d, false);

  // Renderiza dentro de um iframe isolado para escapar das variáveis
  // CSS do Tailwind v4 (oklch/lab) — html2canvas não suporta essas funções.
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "900px";
  iframe.style.height = "1400px";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  // Aguarda fontes/imagens carregarem
  await new Promise((r) => setTimeout(r, 400));
  try { await (doc as any).fonts?.ready; } catch {}

  const target = (doc.querySelector(".doc") as HTMLElement) ?? doc.body;
  const nomeSetor = (d.setor ?? "geral").replace(/[^\w-]+/g, "_");
  const filename = `${d.tipo === "nf" ? "NF" : "Fatura"}_${nomeSetor}_${new Date().toISOString().slice(0, 10)}.pdf`;

  try {
    const mod: any = await import("html2pdf.js");
    const html2pdf = mod.default ?? mod;
    await html2pdf()
      .set({
        margin: [8, 6, 8, 6],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 900 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(target)
      .save();
  } finally {
    document.body.removeChild(iframe);
  }
}



function formatDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
}
function formatMes(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
}
