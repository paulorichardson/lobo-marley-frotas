// Validações e máscaras BR + lookups BrasilAPI

export function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCEP(v: string): string {
  return v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

export function maskCPF(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d)/, "($1) $2-$3");
  }
  return d.replace(/(\d{2})(\d{5})(\d)/, "($1) $2-$3");
}

// Validação do dígito verificador do CNPJ
export function isValidCNPJ(value: string): boolean {
  const cnpj = value.replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string, factors: number[]) => {
    const sum = factors.reduce((acc, f, i) => acc + Number(base[i]) * f, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const f1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const f2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), f1);
  const d2 = calc(cnpj.slice(0, 12) + d1, f2);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

export function isValidCPF(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(cpf[i]) * (n + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export interface CnpjData {
  razao_social?: string;
  nome_fantasia?: string;
  ddd_telefone_1?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
}

export async function lookupCNPJ(cnpj: string): Promise<CnpjData | null> {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export interface CepData {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
}

export async function lookupCEP(cep: string): Promise<CepData | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${d}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Força da senha 0..4
export function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Muito fraca", "Fraca", "Razoável", "Forte", "Muito forte"];
  return { score, label: labels[score] };
}

export const BANCOS_BR = [
  "001 - Banco do Brasil",
  "033 - Santander",
  "077 - Inter",
  "104 - Caixa Econômica",
  "208 - BTG Pactual",
  "212 - Banco Original",
  "237 - Bradesco",
  "260 - Nubank",
  "290 - PagBank",
  "323 - Mercado Pago",
  "336 - C6 Bank",
  "341 - Itaú",
  "380 - PicPay",
  "422 - Safra",
  "748 - Sicredi",
  "756 - Sicoob",
];

export const TIPOS_FORNECIMENTO = [
  { value: "posto", label: "⛽ Posto de Combustível" },
  { value: "oficina", label: "🔧 Oficina Mecânica" },
  { value: "pecas", label: "🏪 Casa de Peças" },
  { value: "guincho", label: "🚛 Transporte / Guincho" },
  { value: "outros", label: "📦 Outros Fornecimentos" },
];
