// Edge function: cria usuário (não confirmado, sem role) e salva cadastro pendente
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  // empresa
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  tipos_fornecimento: string[];
  telefone?: string;
  whatsapp?: string;
  // endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  // bancário
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta?: string;
  pix_chave?: string;
  pix_tipo?: string;
  // responsável
  responsavel_nome: string;
  responsavel_cpf?: string;
  responsavel_cargo?: string;
  email_login: string;
  senha: string;
  // termos
  aceitou_termos: boolean;
  aceitou_dados_bancarios: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: Payload = await req.json();

    // Validação mínima
    const required = ["razao_social", "cnpj", "responsavel_nome", "email_login", "senha"] as const;
    for (const k of required) {
      if (!body[k] || String(body[k]).trim() === "") {
        return json({ error: `Campo obrigatório ausente: ${k}` }, 400);
      }
    }
    if (!body.aceitou_termos || !body.aceitou_dados_bancarios) {
      return json({ error: "É necessário aceitar os termos" }, 400);
    }
    if (!Array.isArray(body.tipos_fornecimento) || body.tipos_fornecimento.length === 0) {
      return json({ error: "Selecione ao menos um tipo de fornecimento" }, 400);
    }
    if (String(body.senha).length < 8) {
      return json({ error: "Senha precisa ter ao menos 8 caracteres" }, 400);
    }

    const cnpjDigits = String(body.cnpj).replace(/\D/g, "");
    if (cnpjDigits.length !== 14) return json({ error: "CNPJ inválido" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verifica duplicidade de CNPJ
    const { data: existeCnpj } = await supabase
      .from("fornecedores_cadastro")
      .select("id")
      .eq("cnpj", cnpjDigits)
      .maybeSingle();
    if (existeCnpj) return json({ error: "Já existe uma solicitação para este CNPJ" }, 409);

    // Cria usuário não confirmado (não pode logar até admin aprovar)
    const { data: userRes, error: userErr } = await supabase.auth.admin.createUser({
      email: body.email_login.trim().toLowerCase(),
      password: body.senha,
      email_confirm: false,
      user_metadata: {
        nome: body.responsavel_nome,
        razao_social: body.razao_social,
        cnpj: cnpjDigits,
      },
    });
    if (userErr || !userRes.user) {
      return json({ error: userErr?.message ?? "Falha ao criar usuário" }, 400);
    }
    const userId = userRes.user.id;

    // Remove a role 'motorista' default criada pelo trigger handle_new_user
    await supabase.from("user_roles").delete().eq("user_id", userId);

    // Insere cadastro pendente
    const { error: insErr } = await supabase.from("fornecedores_cadastro").insert({
      user_id: userId,
      razao_social: body.razao_social,
      nome_fantasia: body.nome_fantasia ?? null,
      cnpj: cnpjDigits,
      tipos_fornecimento: body.tipos_fornecimento,
      telefone: body.telefone ?? null,
      whatsapp: body.whatsapp ?? null,
      cep: body.cep ?? null,
      logradouro: body.logradouro ?? null,
      numero: body.numero ?? null,
      complemento: body.complemento ?? null,
      bairro: body.bairro ?? null,
      cidade: body.cidade ?? null,
      estado: body.estado ?? null,
      banco: body.banco ?? null,
      agencia: body.agencia ?? null,
      conta: body.conta ?? null,
      tipo_conta: body.tipo_conta ?? null,
      pix_chave: body.pix_chave ?? null,
      pix_tipo: body.pix_tipo ?? null,
      responsavel_nome: body.responsavel_nome,
      responsavel_cpf: body.responsavel_cpf ?? null,
      responsavel_cargo: body.responsavel_cargo ?? null,
      email_login: body.email_login.trim().toLowerCase(),
      aceitou_termos: body.aceitou_termos,
      aceitou_dados_bancarios: body.aceitou_dados_bancarios,
      status: "pendente",
    });
    if (insErr) {
      // rollback do user
      await supabase.auth.admin.deleteUser(userId);
      return json({ error: insErr.message }, 400);
    }

    // Atualiza perfil
    await supabase.from("perfis").update({
      nome: body.responsavel_nome,
      telefone: body.telefone ?? body.whatsapp ?? null,
    }).eq("id", userId);

    // Notifica admins
    const { data: adminRoles } = await supabase
      .from("user_roles").select("user_id").eq("role", "admin");
    if (adminRoles && adminRoles.length > 0) {
      const notifs = adminRoles.map((r: any) => ({
        para_id: r.user_id,
        titulo: "Nova solicitação de credenciamento",
        mensagem: `${body.razao_social} (${body.cidade ?? "—"}) solicitou credenciamento como fornecedor.`,
        tipo: "info",
        link: "/admin/configuracoes",
      }));
      await supabase.from("notificacoes").insert(notifs);
    }

    return json({ ok: true, message: "Solicitação enviada" }, 200);
  } catch (e) {
    console.error("submit-credenciamento error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
