// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEMO_USERS = [
  { email: "admin@lobomar.io", password: "Lobomar@2024", nome: "Admin Demo", role: "admin" },
  { email: "gestor@lobomar.io", password: "Lobomar@2024", nome: "Gestor Demo", role: "gestor_frota" },
  { email: "fornecedor@lobomar.io", password: "Lobomar@2024", nome: "Fornecedor Demo", role: "fornecedor" },
  { email: "motorista@lobomar.io", password: "Lobomar@2024", nome: "Motorista Demo", role: "motorista" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const results: any[] = [];

    for (const u of DEMO_USERS) {
      // Tentar criar
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { nome: u.nome },
      });

      let userId: string | null = created?.user?.id ?? null;

      if (createErr && !userId) {
        // já existe → buscar via listUsers
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = list.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
        if (existing) {
          userId = existing.id;
          // garantir senha conhecida
          await admin.auth.admin.updateUserById(existing.id, {
            password: u.password,
            email_confirm: true,
          });
        }
      }

      if (!userId) {
        results.push({ email: u.email, ok: false, error: createErr?.message ?? "unknown" });
        continue;
      }

      // Garantir perfil
      await admin.from("perfis").upsert(
        { id: userId, email: u.email, nome: u.nome },
        { onConflict: "id" },
      );

      // Garantir role correto: limpar e inserir o desejado
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: u.role });

      results.push({ email: u.email, ok: true, role: u.role });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
