// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const USERS = [
  { email: "carlos.motorista@novaesperanca.sim", password: "Sim@2026", nome: "Carlos Henrique Souza", role: "motorista" },
  { email: "bahia.diesel@oficina.sim", password: "Sim@2026", nome: "Centro Automotivo Bahia Diesel", role: "fornecedor" },
  { email: "gestor.novaesperanca@sim.io", password: "Sim@2026", nome: "Gestor Nova Esperança", role: "gestor_frota" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const out: any = {};

    // 1) usuários
    const ids: Record<string, string> = {};
    for (const u of USERS) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: u.email, password: u.password, email_confirm: true,
        user_metadata: { nome: u.nome },
      });
      let id = created?.user?.id ?? null;
      if (!id) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const ex = list.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
        if (ex) { id = ex.id; await admin.auth.admin.updateUserById(ex.id, { password: u.password, email_confirm: true }); }
      }
      if (!id) { out[u.email] = { error: createErr?.message }; continue; }
      ids[u.role] = id;
      await admin.from("perfis").upsert({ id, email: u.email, nome: u.nome }, { onConflict: "id" });
      await admin.from("user_roles").delete().eq("user_id", id);
      await admin.from("user_roles").insert({ user_id: id, role: u.role });
    }

    // 2) Empresa
    let empresa_id: string;
    const { data: empExist } = await admin.from("empresas").select("id").eq("cnpj", "12.345.678/0001-90").maybeSingle();
    if (empExist) {
      empresa_id = empExist.id;
    } else {
      const { data: emp } = await admin.from("empresas").insert({
        razao_social: "Prefeitura Municipal de Nova Esperança",
        nome_fantasia: "Prefeitura de Nova Esperança",
        cnpj: "12.345.678/0001-90",
        cidade: "Nova Esperança", estado: "BA",
        plano: "pro", status: "ativo",
        email: "contato@novaesperanca.ba.gov.br",
      }).select("id").single();
      empresa_id = emp!.id;
    }

    // vincular gestor e motorista à empresa
    if (ids["gestor_frota"]) await admin.from("perfis").update({ empresa_id }).eq("id", ids["gestor_frota"]);
    if (ids["motorista"])    await admin.from("perfis").update({ empresa_id }).eq("id", ids["motorista"]);

    // 3) Contrato
    await admin.from("contratos_clientes").delete().eq("empresa_id", empresa_id).eq("numero_contrato", "087/2026");
    const { data: contrato, error: contratoErr } = await admin.from("contratos_clientes").insert({
      empresa_id, numero_contrato: "087/2026", numero_licitacao: "Pregão Eletrônico 012/2026",
      valor_global: 1500000, tipo_taxa: "negativa", percentual_taxa: 38,
      data_inicio: "2026-06-01", data_fim: "2027-05-31",
      margem_minima: 12, margem_alerta: 6, permitir_prejuizo: false,
      exigir_justificativa: true, ativo: true,
    }).select("id").single();
    if (contratoErr) throw new Error("contrato: " + contratoErr.message);

    // 4) Veículo
    let veiculo_id: string;
    const { data: vExist } = await admin.from("veiculos").select("id").eq("placa", "ABC-2D45").maybeSingle();
    if (vExist) {
      veiculo_id = vExist.id;
      await admin.from("veiculos").update({
        empresa_id, motorista_id: ids["motorista"], setor: "Infraestrutura", km_atual: 87200,
      }).eq("id", veiculo_id);
    } else {
      const { data: v } = await admin.from("veiculos").insert({
        placa: "ABC-2D45", marca: "Fiat", modelo: "Toro 2.0 Diesel",
        ano_fabricacao: 2023, ano_modelo: 2023, combustivel: "Diesel",
        setor: "Infraestrutura", km_atual: 87200, status: "Ativo",
        empresa_id, motorista_id: ids["motorista"], tipo_bem: "veiculo",
      }).select("id").single();
      veiculo_id = v!.id;
    }

    // 5) Fornecedor cadastro
    await admin.from("fornecedores_cadastro").upsert({
      user_id: ids["fornecedor"],
      razao_social: "Centro Automotivo Bahia Diesel LTDA",
      nome_fantasia: "Bahia Diesel",
      cnpj: "22.456.789/0001-55",
      tipos_fornecimento: ["mecanica", "freios"],
      cidade: "Nova Esperança", estado: "BA",
      responsavel_nome: "João Bahia",
      email_login: "bahia.diesel@oficina.sim",
      status: "aprovado", aceitou_termos: true, aceitou_dados_bancarios: true,
      data_aprovacao: new Date().toISOString(),
    }, { onConflict: "user_id" });

    // 6) Solicitação do motorista
    const { data: sol } = await admin.from("solicitacoes").insert({
      empresa_id, veiculo_id, motorista_id: ids["motorista"],
      tipo_problema: "Freio / Mecânico",
      descricao: "Freio fazendo barulho e pedal baixo",
      urgencia: "Alta", status: "Aberta",
    }).select("id").single();

    // 7) OS (Manutenção) — inicialmente em prejuízo
    const { data: manut, error: manutErr } = await admin.from("manutencoes").insert({
      empresa_id, veiculo_id,
      fornecedor_id: ids["fornecedor"],
      solicitado_por: ids["motorista"],
      tipo: "Corretiva", descricao: "Troca completa do sistema de freios",
      diagnostico: "Pastilhas e disco gastos, fluido contaminado",
      status: "Solicitada", prioridade: "Alta",
      km_na_manutencao: 87200,
      valor_mao_obra: 200,
      custo_fornecedor: 650,
      oficina_nome: "Centro Automotivo Bahia Diesel",
    }).select("id, numero_os").single();
    if (manutErr || !manut) throw new Error("manutencao: " + (manutErr?.message || "null"));

    await admin.from("manutencao_pecas").insert([
      { manutencao_id: manut!.id, descricao: "Pastilha de freio", quantidade: 1, valor_unitario: 180 },
      { manutencao_id: manut!.id, descricao: "Disco de freio",    quantidade: 1, valor_unitario: 320 },
      { manutencao_id: manut!.id, descricao: "Fluido de freio",   quantidade: 1, valor_unitario: 50  },
    ]);

    // pegar resultado financeiro do trigger
    const { data: snap1 } = await admin.from("manutencoes").select(
      "numero_os,valor_bruto_pecas,valor_bruto_servicos,percentual_aplicado,valor_liquido_faturavel,custo_fornecedor,lucro_bruto,margem_percentual,status_financeiro"
    ).eq("id", manut!.id).single();

    return new Response(JSON.stringify({
      ok: true,
      empresa_id, contrato_id: contrato?.id, veiculo_id,
      manutencao_id: manut!.id, solicitacao_id: sol?.id,
      users: ids,
      cenario_inicial: snap1,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("seed-simulacao error:", e?.message, e?.stack);
    return new Response(JSON.stringify({ ok: false, error: e?.message, stack: e?.stack }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
