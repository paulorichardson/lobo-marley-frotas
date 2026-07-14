import { createServerFn } from "@tanstack/react-start";

export interface PecaExtraida {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
}

export interface NfExtraida {
  placa: string | null;
  data_emissao: string | null; // YYYY-MM-DD
  fornecedor_nome: string | null;
  fornecedor_cnpj: string | null;
  fornecedor_telefone: string | null;
  fornecedor_email: string | null;
  fornecedor_endereco: string | null;
  fornecedor_cidade: string | null;
  fornecedor_estado: string | null;
  fornecedor_cep: string | null;
  numero_nf: string | null;
  valor_total: number | null;
  valor_mao_obra: number | null;
  tipo_servico: string | null;
  descricao: string | null;
  pecas: PecaExtraida[];
  observacoes: string | null;
}

/**
 * Extrai dados de uma nota fiscal (PDF em base64) via Lovable AI (Gemini).
 * Recebe também dicas: placas conhecidas para o modelo ancorar corretamente.
 */
export const parseNotaFiscalIA = createServerFn({ method: "POST" })
  .inputValidator((input: { pdfBase64: string; mimeType?: string; placasConhecidas?: string[] }) => {
    if (!input?.pdfBase64) throw new Error("pdfBase64 é obrigatório");
    return {
      pdfBase64: input.pdfBase64,
      mimeType: input.mimeType || "application/pdf",
      placasConhecidas: input.placasConhecidas ?? [],
    };
  })
  .handler(async ({ data }): Promise<NfExtraida> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const placasHint =
      data.placasConhecidas.length > 0
        ? `Placas cadastradas na frota (use uma destas se aparecer no documento, normalizando para 7 caracteres sem hífen/espaço): ${data.placasConhecidas.join(", ")}.`
        : "";

    const system = `Você extrai dados de notas fiscais/recibos de manutenção veicular em português.
Responda SEMPRE em JSON estrito, sem texto adicional. Campos numéricos como number, sem R$/pontos de milhar.
Datas no formato YYYY-MM-DD. Placa em 7 caracteres maiúsculos, sem hífen (ex: ABC1D23 ou ABC1234).
Se o campo não estiver presente, use null (ou [] para peças).
Estrutura JSON:
{
  "placa": string|null,
  "data_emissao": string|null,
  "fornecedor_nome": string|null,
  "numero_nf": string|null,
  "valor_total": number|null,
  "valor_mao_obra": number|null,
  "tipo_servico": string|null,
  "descricao": string|null,
  "pecas": [{"descricao": string, "quantidade": number, "valor_unitario": number}],
  "observacoes": string|null
}
Para tipo_servico use um destes valores: "Mecânica / Motor", "Elétrica", "Pneu / Suspensão", "Funilaria / Pintura", "Ar-condicionado", "Troca de peças", "Revisão / Preventiva", "Diagnóstico", "Outros".
${placasHint}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados da nota fiscal em anexo." },
              {
                type: "file",
                file: {
                  filename: "nf.pdf",
                  file_data: `data:${data.mimeType};base64,${data.pdfBase64}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Muitas requisições à IA. Tente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
      throw new Error(`Erro IA (${res.status}): ${t.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const toNum = (v: any): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(String(v).replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };

    return {
      placa: parsed.placa ? String(parsed.placa).toUpperCase().replace(/[^A-Z0-9]/g, "") : null,
      data_emissao: parsed.data_emissao ?? null,
      fornecedor_nome: parsed.fornecedor_nome ?? null,
      numero_nf: parsed.numero_nf ? String(parsed.numero_nf) : null,
      valor_total: toNum(parsed.valor_total),
      valor_mao_obra: toNum(parsed.valor_mao_obra),
      tipo_servico: parsed.tipo_servico ?? null,
      descricao: parsed.descricao ?? null,
      pecas: Array.isArray(parsed.pecas)
        ? parsed.pecas.map((p: any) => ({
            descricao: String(p?.descricao ?? ""),
            quantidade: Number(p?.quantidade ?? 1) || 1,
            valor_unitario: toNum(p?.valor_unitario) ?? 0,
          }))
        : [],
      observacoes: parsed.observacoes ?? null,
    };
  });
