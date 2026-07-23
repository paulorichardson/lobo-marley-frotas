import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const EMAIL = "paulorichardson@gmail.com";
  const SENHA = "Paulo@206213";
  const USER_ID = "e8a2d484-2843-49a7-a5a9-29b1e1bad019";

  const { error } = await admin.auth.admin.updateUserById(USER_ID, {
    password: SENHA,
    email_confirm: true,
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  await admin.from("user_roles").upsert({ user_id: USER_ID, role: "admin" }, { onConflict: "user_id,role" });

  return new Response(JSON.stringify({ ok: true, email: EMAIL }), { headers: { ...cors, "Content-Type": "application/json" } });
});
