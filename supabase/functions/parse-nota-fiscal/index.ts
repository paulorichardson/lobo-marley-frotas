// Extrai dados estruturados de uma nota fiscal de fornecedor (PDF) usando IA.
// Recebe: { filename, mime_type, file_base64 }
// Retorna: { numero_nf, data_emissao, fornecedor:{cnpj,nome}, valor_total,
//            descricao, placa_veiculo, tipo_servico, itens[] }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHEMA_PROMPT = `Você é um extrator de dados de notas fiscais brasileiras (NF-e/NFS-e/Cupom Fiscal).
Analise o documento anexado e devolva APENAS um JSON com este formato (sem markdown, sem comentários):

{
  "numero_nf": "string ou null",
  "serie_nf": "string ou null",
  "data_emissao": "YYYY-MM-DD ou null",
  "fornecedor": {
    "cnpj": "apenas dígitos, 14 caracteres, ou null",
    "razao_social": "string ou null",
    "nome_fantasia": "string ou null"
  },
  "tomador": {
    "cnpj": "apenas dígitos ou null",
    "nome": "string ou null"
  },
  "valor_total": número decimal (use ponto como separador),
  "valor_servicos": número ou null,
  "valor_pecas": número ou null,
  "descricao": "resumo curto dos serviços/produtos (máx 240 chars)",
  "placa_veiculo": "placa Mercosul/antiga sem hífen, em maiúsculas, ou null (procure no corpo, descrição, chassi ou observações)",
  "tipo_servico": "Preventiva|Corretiva|Pneu|Elétrica|Funilaria|Revisão|Outro",
  "itens": [
    { "descricao": "string", "quantidade": número, "valor_unitario": número, "valor_total": número }
  ]
}

Se algum campo não puder ser extraído com segurança, use null.
NUNCA invente CNPJ ou valor.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405, headers: CORS });

  try {
    const { filename, mime_type, file_base64 } = await req.json();
    if (!file_base64) {
      return new Response(JSON.stringify({ error: "file_base64 obrigatório" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const mime = mime_type || "application/pdf";
    const dataUrl = `data:${mime};base64,${file_base64}`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SCHEMA_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Extraia os dados desta nota fiscal (arquivo: ${filename ?? "documento"}).` },
            { type: "file", file: { filename: filename ?? "nota.pdf", file_data: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    };

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text();
      return new Response(JSON.stringify({ error: `IA ${r.status}: ${text.slice(0, 500)}` }), {
        status: r.status === 429 || r.status === 402 ? r.status : 502,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const json = await r.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      const m = String(content).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
