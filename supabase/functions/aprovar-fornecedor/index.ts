// Edge function: admin aprova ou reprova um cadastro de fornecedor
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  cadastro_id: string;
  acao: "aprovar" | "reprovar";
  motivo?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Não autenticado" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Valida que o chamador é admin
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: uerr } = await userClient.auth.getUser();
    if (uerr || !userData.user) return j({ error: "Sessão inválida" }, 401);

    const adminClient = createClient(url, serviceKey);
    const { data: roleRow } = await adminClient
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return j({ error: "Apenas admin pode aprovar/reprovar" }, 403);

    const body: Payload = await req.json();
    if (!body.cadastro_id || !body.acao) return j({ error: "Parâmetros ausentes" }, 400);
    if (body.acao === "reprovar" && (!body.motivo || body.motivo.trim().length < 3)) {
      return j({ error: "Informe o motivo da reprovação" }, 400);
    }

    const { data: cad, error: cerr } = await adminClient
      .from("fornecedores_cadastro").select("*").eq("id", body.cadastro_id).maybeSingle();
    if (cerr || !cad) return j({ error: "Cadastro não encontrado" }, 404);
    if (cad.status !== "pendente") return j({ error: `Cadastro já está ${cad.status}` }, 400);

    if (body.acao === "aprovar") {
      // Confirma email + ativa role fornecedor
      const { error: aerr } = await adminClient.auth.admin.updateUserById(cad.user_id, {
        email_confirm: true,
      });
      if (aerr) return j({ error: aerr.message }, 400);

      await adminClient.from("user_roles").delete().eq("user_id", cad.user_id);
      await adminClient.from("user_roles").insert({ user_id: cad.user_id, role: "fornecedor" });

      await adminClient.from("fornecedores_cadastro").update({
        status: "aprovado",
        aprovado_por: userData.user.id,
        data_aprovacao: new Date().toISOString(),
        motivo_reprovacao: null,
      }).eq("id", cad.id);

      await adminClient.from("notificacoes").insert({
        para_id: cad.user_id,
        titulo: "Credenciamento aprovado ✅",
        mensagem: `Sua empresa ${cad.razao_social} foi aprovada. Você já pode acessar o sistema.`,
        tipo: "success",
        link: "/login",
      });
    } else {
      await adminClient.from("fornecedores_cadastro").update({
        status: "reprovado",
        aprovado_por: userData.user.id,
        data_aprovacao: new Date().toISOString(),
        motivo_reprovacao: body.motivo,
      }).eq("id", cad.id);

      await adminClient.from("notificacoes").insert({
        para_id: cad.user_id,
        titulo: "Credenciamento reprovado ❌",
        mensagem: `Sua solicitação foi reprovada. Motivo: ${body.motivo}`,
        tipo: "error",
      });
    }

    return j({ ok: true }, 200);
  } catch (e) {
    console.error("aprovar-fornecedor", e);
    return j({ error: (e as Error).message }, 500);
  }
});

function j(p: unknown, s: number) {
  return new Response(JSON.stringify(p), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
