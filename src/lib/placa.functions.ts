import { createServerFn } from "@tanstack/react-start";
import type { DadosPlacaApi } from "./placa";
import { normalizarPlaca, placaValida } from "./placa";

/**
 * Consulta veículo na API Brasil (gateway.apibrasil.io — endpoint Veículos/Dados).
 * Requer os secrets APIBRASIL_BEARER_TOKEN e APIBRASIL_DEVICE_TOKEN.
 */
export const consultarPlacaApiBrasil = createServerFn({ method: "POST" })
  .inputValidator((input: { placa: string }) => {
    const p = normalizarPlaca(input.placa);
    if (!placaValida(p)) throw new Error("Placa inválida");
    return { placa: p };
  })
  .handler(async ({ data }): Promise<DadosPlacaApi | null> => {
    const bearer = process.env.APIBRASIL_BEARER_TOKEN;
    const device = process.env.APIBRASIL_DEVICE_TOKEN;
    if (!bearer || !device) {
      throw new Error("APIBRASIL_BEARER_TOKEN / APIBRASIL_DEVICE_TOKEN não configurados");
    }

    const res = await fetch("https://gateway.apibrasil.io/api/v2/vehicles/dados", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        DeviceToken: device,
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ placa: data.placa }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`API Brasil ${res.status}: ${txt.slice(0, 200)}`);
    }

    const json: any = await res.json();
    // API Brasil retorna { error: false, response: { ...dados } } ou { error: true, message }
    if (json?.error) return null;
    const r = json?.response ?? json;
    if (!r || typeof r !== "object") return null;

    const ano = r.ano ?? r.anoFabricacao ?? r.ano_fabricacao;
    const anoModelo = r.anoModelo ?? r.ano_modelo;

    return {
      marca: r.marca ?? r.MARCA,
      modelo: r.modelo ?? r.MODELO,
      ano: ano ? Number(ano) : undefined,
      anoModelo: anoModelo ? Number(anoModelo) : undefined,
      cor: r.cor ?? r.COR,
      combustivel: normalizarCombustivel(r.combustivel ?? r.COMBUSTIVEL),
      chassi: r.chassi ?? r.CHASSI,
    };
  });

function normalizarCombustivel(c?: string): string | undefined {
  if (!c) return undefined;
  const lc = c.toLowerCase();
  if (lc.includes("flex") || lc.includes("álcool") || lc.includes("alcool")) return "Flex";
  if (lc.includes("diesel")) return "Diesel";
  if (lc.includes("elétr") || lc.includes("eletr")) return "Elétrico";
  if (lc.includes("gnv") || lc.includes("gás")) return "GNV";
  if (lc.includes("híbri") || lc.includes("hibri")) return "Híbrido";
  if (lc.includes("gasolina")) return "Gasolina";
  return c;
}
