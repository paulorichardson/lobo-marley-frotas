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

    // valida que quem chamou é admin
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
    if (!isAdmin) return json({ error: "Apenas admin pode cadastrar clientes" }, 403);

    const body = await req.json();
    const { empresa, gestor } = body ?? {};
    if (!empresa?.razao_social) return json({ error: "Razão social obrigatória" }, 400);
    if (!gestor?.email || !gestor?.senha || !gestor?.nome)
      return json({ error: "Dados do gestor incompletos" }, 400);
    if (String(gestor.senha).length < 8)
      return json({ error: "Senha do gestor deve ter pelo menos 8 caracteres" }, 400);

    // 1. cria empresa
    const { data: empresaRow, error: empErr } = await admin
      .from("empresas")
      .insert({ ...empresa, criado_por: who.user.id })
      .select("*")
      .single();
    if (empErr) return json({ error: `Empresa: ${empErr.message}` }, 400);

    // 2. cria usuário gestor (email já confirmado)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: gestor.email,
      password: gestor.senha,
      email_confirm: true,
      user_metadata: { nome: gestor.nome, telefone: gestor.telefone ?? null },
    });
    if (cErr || !created.user) {
      // rollback empresa
      await admin.from("empresas").delete().eq("id", empresaRow.id);
      return json({ error: `Auth: ${cErr?.message ?? "falha ao criar usuário"}` }, 400);
    }
    const userId = created.user.id;

    // 3. atualiza perfil (criado pelo trigger handle_new_user) com empresa
    await admin
      .from("perfis")
      .update({
        nome: gestor.nome,
        telefone: gestor.telefone ?? null,
        empresa_id: empresaRow.id,
      })
      .eq("id", userId);

    // 4. troca role default (motorista) por gestor_frota
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role: "gestor_frota" });

    // 5. notifica o admin que criou
    await admin.from("notificacoes").insert({
      para_id: who.user.id,
      titulo: "Cliente cadastrado",
      mensagem: `Empresa ${empresaRow.razao_social} criada com gestor ${gestor.nome}.`,
      tipo: "sucesso",
      link: `/admin/clientes`,
    });

    return json({ ok: true, empresa: empresaRow, gestor_id: userId });
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
