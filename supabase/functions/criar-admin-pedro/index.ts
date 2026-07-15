// One-shot: cria usuário admin Pedro. Após execução, esta função pode ser removida.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const EMAIL = "advogado.phrm@gmail.com";
    const SENHA = "102030";
    const NOME = "Pedro";

    // Se já existe, apenas reseta senha e garante role admin
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === EMAIL.toLowerCase());

    let userId: string;
    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password: SENHA, email_confirm: true });
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: EMAIL,
        password: SENHA,
        email_confirm: true,
        user_metadata: { nome: NOME },
      });
      if (error || !created.user) {
        return new Response(JSON.stringify({ error: error?.message ?? "falha" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      userId = created.user.id;
    }

    await admin.from("perfis").upsert({ id: userId, email: EMAIL, nome: NOME });
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role: "admin" });

    return new Response(JSON.stringify({ ok: true, user_id: userId, email: EMAIL }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
