// Helpers de placa veicular brasileira (antiga + Mercosul)

export function normalizarPlaca(placa: string): string {
  return (placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

export function formatarPlaca(placa: string): string {
  const p = normalizarPlaca(placa);
  if (p.length <= 3) return p;
  return `${p.slice(0, 3)}-${p.slice(3)}`;
}

// Aceita AAA0000 (antiga) e AAA0A00 (Mercosul)
export function placaValida(placa: string): boolean {
  const p = normalizarPlaca(placa);
  if (p.length !== 7) return false;
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p);
}

export interface DadosPlacaApi {
  marca?: string;
  modelo?: string;
  ano?: number;
  anoModelo?: number;
  cor?: string;
  combustivel?: string;
  chassi?: string;
}

// Consulta BrasilAPI (gratuita). Retorna null se não encontrado.
export async function consultarPlaca(placa: string): Promise<DadosPlacaApi | null> {
  const p = normalizarPlaca(placa);
  if (!placaValida(p)) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/vehicles/v1/${p}`);
    if (!res.ok) return null;
    const data: any = await res.json();
    return {
      marca: data.marca,
      modelo: data.modelo,
      ano: data.ano ? Number(data.ano) : undefined,
      anoModelo: data.anoModelo ? Number(data.anoModelo) : undefined,
      cor: data.cor,
      combustivel: normalizarCombustivel(data.combustivel),
      chassi: data.chassi,
    };
  } catch {
    return null;
  }
}

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
