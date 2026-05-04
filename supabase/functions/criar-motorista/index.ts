// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    if (!auth) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: who } = await userClient.auth.getUser();
    if (!who.user) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", who.user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const isGestor = (roles ?? []).some((r: any) => r.role === "gestor_frota");
    if (!isAdmin && !isGestor) return json({ error: "Sem permissão" }, 403);

    const body = await req.json();
    const action = body?.action ?? "create";

    // Admin/gestor define empresa
    let empresaId: string | null = body?.empresa_id ?? null;
    if (!empresaId) {
      const { data: meu } = await admin
        .from("perfis").select("empresa_id").eq("id", who.user.id).maybeSingle();
      empresaId = meu?.empresa_id ?? null;
    }

    if (action === "create") {
      const { motorista, vincular_veiculo_id } = body;
      if (!motorista?.email || !motorista?.senha || !motorista?.nome)
        return json({ error: "Dados incompletos" }, 400);
      if (String(motorista.senha).length < 8)
        return json({ error: "Senha deve ter pelo menos 8 caracteres" }, 400);
      if (!empresaId) return json({ error: "Empresa não identificada" }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: motorista.email,
        password: motorista.senha,
        email_confirm: true,
        user_metadata: { nome: motorista.nome, telefone: motorista.telefone ?? null },
      });
      if (cErr || !created.user) {
        const msg = cErr?.message ?? "Falha auth";
        const friendly = /already.*registered|already exists|email_exists/i.test(msg)
          ? `Já existe um usuário com o e-mail ${motorista.email}. Use outro e-mail ou peça para o admin reativar/resetar a senha desse motorista.`
          : msg;
        return json({ error: friendly }, 400);
      }
      const userId = created.user.id;

      await admin.from("perfis").update({
        nome: motorista.nome,
        telefone: motorista.telefone ?? null,
        empresa_id: empresaId,
      }).eq("id", userId);

      // Garante role motorista (handle_new_user já cria, mas reforça)
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: "motorista" });

      if (vincular_veiculo_id) {
        await admin.from("veiculos")
          .update({ motorista_id: userId })
          .eq("id", vincular_veiculo_id)
          .eq("empresa_id", empresaId);
      }

      return json({ ok: true, motorista_id: userId });
    }

    if (action === "reset_password") {
      const { motorista_id, nova_senha } = body;
      if (!motorista_id || !nova_senha || String(nova_senha).length < 8)
        return json({ error: "Dados inválidos" }, 400);
      const { error } = await admin.auth.admin.updateUserById(motorista_id, {
        password: nova_senha,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "toggle_ativo") {
      const { motorista_id, ativo } = body;
      if (!motorista_id) return json({ error: "ID obrigatório" }, 400);
      const { error } = await admin.from("perfis")
        .update({ ativo: !!ativo }).eq("id", motorista_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "vincular_veiculo") {
      const { motorista_id, veiculo_id } = body;
      if (!motorista_id || !veiculo_id) return json({ error: "Dados incompletos" }, 400);
      // Desvincula de qualquer outro veículo
      await admin.from("veiculos")
        .update({ motorista_id: null })
        .eq("motorista_id", motorista_id);
      const { error } = await admin.from("veiculos")
        .update({ motorista_id })
        .eq("id", veiculo_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
