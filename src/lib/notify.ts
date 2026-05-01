import { supabase } from "@/integrations/supabase/client";

/**
 * Notifica todos os gestores (gestor_frota) de uma empresa.
 */
export async function notifyEmpresaGestores(opts: {
  empresaId: string | null | undefined;
  titulo: string;
  mensagem: string;
  tipo?: "info" | "sucesso" | "alerta";
  link?: string;
}) {
  if (!opts.empresaId) return;
  // Busca perfis gestores da empresa
  const { data: perfis } = await supabase
    .from("perfis")
    .select("id")
    .eq("empresa_id", opts.empresaId);
  if (!perfis || perfis.length === 0) return;

  const ids = perfis.map((p) => p.id);
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("user_id", ids)
    .eq("role", "gestor_frota");

  const gestorIds = (roles ?? []).map((r) => r.user_id);
  if (gestorIds.length === 0) return;

  await supabase.from("notificacoes").insert(
    gestorIds.map((id) => ({
      para_id: id,
      titulo: opts.titulo,
      mensagem: opts.mensagem,
      tipo: opts.tipo ?? "info",
      link: opts.link ?? null,
    })),
  );
}

/**
 * Notifica todos os usuários com role admin.
 */
export async function notifyAdmins(opts: {
  titulo: string;
  mensagem: string;
  tipo?: "info" | "sucesso" | "alerta";
  link?: string;
}) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return;
  await supabase.from("notificacoes").insert(
    ids.map((id) => ({
      para_id: id,
      titulo: opts.titulo,
      mensagem: opts.mensagem,
      tipo: opts.tipo ?? "info",
      link: opts.link ?? null,
    })),
  );
}
