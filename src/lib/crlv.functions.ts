import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcularVencimentoLicenciamento } from "./licenciamento";

const SYSTEM_PROMPT = `Você extrai dados estruturados do documento CRLV-e (Certificado de Registro e Licenciamento de Veículo eletrônico) brasileiro.
Retorne SOMENTE um JSON com os campos:
{
  "placa": "string (7 caracteres, sem traço)",
  "renavam": "string",
  "chassi": "string (17 caracteres)",
  "marca": "string",
  "modelo": "string",
  "ano_fabricacao": número,
  "ano_modelo": número,
  "cor": "string",
  "combustivel": "string (Gasolina|Etanol|Flex|Diesel|GNV|Elétrico|Híbrido)",
  "categoria": "string (Carro|Caminhonete|Van|Ônibus|Caminhão|Moto|Máquina|Outro)",
  "uf": "string (sigla do estado emissor: SP, BA, RJ, MG, etc.)",
  "exercicio": número (ano do exercício do licenciamento, ex: 2025),
  "licenciamento_data": "string (data de validade do licenciamento no formato YYYY-MM-DD, se constar explicitamente no documento)"
}

Regras:
- "exercicio" é o ano que aparece no campo "EXERCÍCIO" do CRLV — geralmente é o ano de validade.
- "licenciamento_data" SOMENTE se houver data explícita (ex: "31/12/2025"). Se só houver o ano, deixe null.
- Se um campo não estiver claramente legível, use null. Não invente.
- "combustivel" → mapeie para uma das opções listadas (ex.: "ALCOOL/GASOLINA" = "Flex").
- "categoria" → use uma das opções listadas; ônibus escolar = "Ônibus", caminhonete = "Caminhonete".`;

const InputSchema = z.object({
  pdfBase64: z.string().min(100),
  fileName: z.string().optional(),
  accessToken: z.string().min(20),
});

export const parseCrlv = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    // Autentica o usuário pelo bearer token enviado pelo cliente
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(
      data.accessToken,
    );
    if (userErr || !userData?.user) {
      throw new Error("Não autorizado");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor");

    const dataUrl = `data:application/pdf;base64,${data.pdfBase64}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extraia os dados do CRLV anexo${data.fileName ? ` (arquivo: ${data.fileName})` : ""}.`,
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) {
      throw new Error("Limite de requisições de IA excedido. Aguarde alguns instantes e tente novamente.");
    }
    if (resp.status === 402) {
      throw new Error("Créditos de IA insuficientes. Adicione créditos em Configurações → Workspace → Usage.");
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      throw new Error(`Falha na IA (${resp.status}). Tente novamente.`);
    }

    const json: any = await resp.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    // Normalizações
    if (parsed.placa) parsed.placa = String(parsed.placa).replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (parsed.chassi) parsed.chassi = String(parsed.chassi).toUpperCase();
    if (parsed.uf) parsed.uf = String(parsed.uf).toUpperCase().slice(0, 2);

    // Calcula vencimento de licenciamento se não vier explícito
    let licenciamento_calculado = false;
    if (!parsed.licenciamento_data && parsed.exercicio && parsed.placa && parsed.uf) {
      const calc = calcularVencimentoLicenciamento(
        parsed.uf,
        parsed.placa,
        Number(parsed.exercicio),
      );
      if (calc) {
        parsed.licenciamento_data = calc;
        licenciamento_calculado = true;
      }
    }

    return {
      ok: true as const,
      dados: parsed,
      licenciamento_calculado,
    };
  });
