// Edge function pública para abastecimento via QR Code (sem login)
// GET ?veiculo_id=... -> retorna dados básicos do veículo
// POST -> registra abastecimento (multipart/form-data com comprovante)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sb = admin();

    // GET — busca dados do veículo para exibir na tela pública
    if (req.method === "GET") {
      const veiculoId = url.searchParams.get("veiculo_id");
      if (!veiculoId) {
        return json({ error: "veiculo_id obrigatório" }, 400);
      }
      const { data: v, error } = await sb
        .from("veiculos")
        .select("id, placa, marca, modelo, km_atual, combustivel, empresa_id, motorista_id, foto_principal_url")
        .eq("id", veiculoId)
        .maybeSingle();
      if (error || !v) return json({ error: "Veículo não encontrado" }, 404);

      let empresa: any = null;
      if (v.empresa_id) {
        const { data: e } = await sb
          .from("empresas")
          .select("nome_fantasia, razao_social")
          .eq("id", v.empresa_id)
          .maybeSingle();
        empresa = e;
      }
      return json({ veiculo: v, empresa });
    }

    // POST — registra abastecimento
    if (req.method === "POST") {
      const fd = await req.formData();
      const veiculo_id = String(fd.get("veiculo_id") || "");
      const fornecedor_cnpj = String(fd.get("fornecedor_cnpj") || "").replace(/\D/g, "");
      const data_hora = String(fd.get("data_hora") || new Date().toISOString());
      const combustivel = String(fd.get("combustivel") || "");
      const litros = Number(fd.get("litros") || 0);
      const valor_litro = Number(fd.get("valor_litro") || 0);
      const km_atual = Number(fd.get("km_atual") || 0);
      const posto = String(fd.get("posto") || "");
      const motorista_nome = String(fd.get("motorista_nome") || "");
      const observacoes = String(fd.get("observacoes") || "");
      const comprovante = fd.get("comprovante") as File | null;
      const hodometro = fd.get("hodometro") as File | null;

      if (!veiculo_id || !fornecedor_cnpj || !litros || !valor_litro || !km_atual) {
        return json({ error: "Campos obrigatórios ausentes" }, 400);
      }
      if (!comprovante) return json({ error: "Comprovante obrigatório" }, 400);

      // Valida veículo
      const { data: v } = await sb
        .from("veiculos")
        .select("id, empresa_id, motorista_id, km_atual, placa")
        .eq("id", veiculo_id)
        .maybeSingle();
      if (!v) return json({ error: "Veículo inválido" }, 404);
      if (Number(km_atual) < Number(v.km_atual)) {
        return json({ error: `KM informado (${km_atual}) menor que último (${v.km_atual})` }, 400);
      }

      // Localiza fornecedor pelo CNPJ
      const { data: f } = await sb
        .from("fornecedores_cadastro")
        .select("user_id, nome_fantasia, razao_social, status")
        .eq("cnpj", fornecedor_cnpj)
        .maybeSingle();
      if (!f || !f.user_id || f.status !== "aprovado") {
        return json({ error: "Fornecedor não encontrado ou não aprovado" }, 404);
      }

      // Upload de arquivos
      const prefix = `qrcode/${veiculo_id}/${Date.now()}`;
      const upload = async (file: File, sub: string) => {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${prefix}/${sub}.${ext}`;
        const { error } = await sb.storage.from("comprovantes").upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
        if (error) throw error;
        return path;
      };

      const compPath = await upload(comprovante, "comprovante");
      const hodoPath = hodometro ? await upload(hodometro, "hodometro") : null;

      const total = litros * valor_litro;
      const obs = [
        observacoes,
        motorista_nome ? `Motorista: ${motorista_nome}` : null,
        hodoPath ? `Hodômetro: ${hodoPath}` : null,
        "Origem: QR Code",
      ].filter(Boolean).join(" | ");

      const { data: ab, error: insErr } = await sb.from("abastecimentos").insert({
        veiculo_id,
        fornecedor_id: f.user_id,
        motorista_id: v.motorista_id,
        empresa_id: v.empresa_id,
        data_hora: new Date(data_hora).toISOString(),
        combustivel,
        litros,
        valor_litro,
        valor_total: total,
        km_atual,
        posto: posto || f.nome_fantasia || f.razao_social,
        comprovante_url: compPath,
        observacoes: obs,
        via_qrcode: true,
      }).select("id").single();
      if (insErr) throw insErr;

      // Notifica gestores da empresa
      if (v.empresa_id) {
        const { data: gestores } = await sb
          .from("perfis")
          .select("id")
          .eq("empresa_id", v.empresa_id);
        if (gestores?.length) {
          // só gestores
          const ids = gestores.map((g) => g.id);
          const { data: roles } = await sb
            .from("user_roles")
            .select("user_id")
            .eq("role", "gestor_frota")
            .in("user_id", ids);
          const targets = (roles ?? []).map((r) => r.user_id);
          if (targets.length) {
            await sb.from("notificacoes").insert(
              targets.map((uid) => ({
                para_id: uid,
                titulo: "Abastecimento via QR Code",
                mensagem: `${v.placa} • ${litros}L • R$ ${total.toFixed(2)}`,
                tipo: "info",
              }))
            );
          }
        }
      }

      return json({ ok: true, id: ab.id, total });
    }

    return json({ error: "Método não suportado" }, 405);
  } catch (err) {
    console.error("[abastecimento-publico]", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
