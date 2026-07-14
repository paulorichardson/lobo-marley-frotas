import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AutoRegistrarInput {
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

export interface AutoRegistrarResult {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  user_id: string | null;
  criado: boolean; // true = novo, false = já existia
}

/**
 * Cria (ou retorna existente) um fornecedor a partir de dados extraídos de NF pela IA.
 * Utiliza admin client (bypass RLS) após validar que o chamador é gestor_frota/admin.
 */
export const autoRegistrarFornecedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AutoRegistrarInput) => {
    if (!input?.razao_social || input.razao_social.trim().length < 2) {
      throw new Error("razao_social é obrigatório");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<AutoRegistrarResult> => {
    const { supabase, userId } = context;

    // Autorização: precisa ser gestor_frota ou admin
    const { data: roles } = await supabase.rpc("get_my_roles");
    const rolesList = (roles as any[])?.map((r: any) => (typeof r === "string" ? r : r.role)) ?? [];
    const permitido = rolesList.some((r: string) => r === "admin" || r === "gestor_frota");
    if (!permitido) throw new Error("Sem permissão para cadastrar fornecedor");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cnpjDigits = data.cnpj ? data.cnpj.replace(/\D/g, "") : "";

    // Dedup: primeiro por CNPJ (se houver), depois por razão social
    if (cnpjDigits.length >= 11) {
      const { data: existByCnpj } = await supabaseAdmin
        .from("fornecedores_cadastro")
        .select("id, razao_social, nome_fantasia, user_id")
        .eq("cnpj", cnpjDigits)
        .maybeSingle();
      if (existByCnpj) return { ...existByCnpj, criado: false };
    } else {
      const { data: existByNome } = await supabaseAdmin
        .from("fornecedores_cadastro")
        .select("id, razao_social, nome_fantasia, user_id")
        .ilike("razao_social", data.razao_social.trim())
        .maybeSingle();
      if (existByNome) return { ...existByNome, criado: false };
    }

    // Gera CNPJ sintético se não fornecido (para satisfazer NOT NULL)
    const cnpjFinal =
      cnpjDigits.length === 14
        ? cnpjDigits
        : `AUTO-${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 1000)}`;

    const slug = data.razao_social
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "fornecedor";
    const emailLogin =
      data.email && /@/.test(data.email)
        ? data.email
        : `${slug}-${Date.now().toString(36)}@auto.nf.local`;

    const insertPayload: any = {
      razao_social: data.razao_social.trim(),
      nome_fantasia: data.nome_fantasia ?? null,
      cnpj: cnpjFinal,
      telefone: data.telefone ?? null,
      logradouro: data.endereco ?? null,
      cidade: data.cidade ?? null,
      estado: data.estado ?? null,
      cep: data.cep ?? null,
      responsavel_nome: data.razao_social.trim(),
      email_login: emailLogin,
      tipos_fornecimento: ["Manutenção"],
      status: "aprovado",
      aprovado_por: userId,
      data_aprovacao: new Date().toISOString(),
      aceitou_termos: true,
      aceitou_dados_bancarios: false,
    };

    const { data: novo, error } = await supabaseAdmin
      .from("fornecedores_cadastro")
      .insert(insertPayload)
      .select("id, razao_social, nome_fantasia, user_id")
      .single();

    if (error) throw new Error(`Falha ao cadastrar fornecedor: ${error.message}`);

    return { ...novo, criado: true };
  });
