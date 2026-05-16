/**
 * Calendário oficial de licenciamento (CRLV) por UF e final da placa.
 * Retorna o MÊS (1-12) em que o licenciamento vence no exercício.
 * Fontes: Detrans estaduais (calendários publicados anualmente — pode haver
 * pequenas variações de ano para ano; o mês é o referencial padrão).
 */
export const CALENDARIO_LICENCIAMENTO: Record<string, Record<string, number>> = {
  SP: { "1": 4, "2": 5, "3": 6, "4": 7, "5": 8, "6": 9, "7": 10, "8": 11, "9": 12, "0": 12 },
  BA: { "1": 4, "2": 5, "3": 6, "4": 7, "5": 8, "6": 9, "7": 10, "8": 10, "9": 11, "0": 11 },
  RJ: { "1": 3, "2": 4, "3": 5, "4": 6, "5": 7, "6": 8, "7": 9, "8": 10, "9": 11, "0": 12 },
  MG: { "1": 4, "2": 5, "3": 6, "4": 7, "5": 8, "6": 9, "7": 10, "8": 11, "9": 11, "0": 12 },
  PR: { "1": 7, "2": 7, "3": 8, "4": 8, "5": 9, "6": 9, "7": 10, "8": 10, "9": 11, "0": 11 },
  RS: { "1": 5, "2": 6, "3": 7, "4": 8, "5": 9, "6": 10, "7": 11, "8": 12, "9": 12, "0": 12 },
  SC: { "1": 4, "2": 5, "3": 6, "4": 7, "5": 8, "6": 9, "7": 10, "8": 11, "9": 11, "0": 12 },
  PE: { "1": 4, "2": 5, "3": 6, "4": 7, "5": 8, "6": 9, "7": 10, "8": 11, "9": 11, "0": 12 },
  CE: { "1": 5, "2": 6, "3": 7, "4": 7, "5": 8, "6": 9, "7": 9, "8": 10, "9": 11, "0": 12 },
  GO: { "1": 4, "2": 5, "3": 6, "4": 7, "5": 8, "6": 8, "7": 9, "8": 10, "9": 11, "0": 12 },
  DF: { "1": 5, "2": 6, "3": 7, "4": 8, "5": 9, "6": 10, "7": 11, "8": 11, "9": 12, "0": 12 },
};

export const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

/**
 * Calcula o vencimento do CRLV no formato YYYY-MM-DD.
 * - Usa o último dígito da placa para localizar o mês no calendário da UF.
 * - Usa o último dia do mês como vencimento.
 * - Se a data já passou no exercício informado, avança para o próximo ano.
 * Retorna null quando UF não tem calendário cadastrado ou placa sem dígito.
 */
export function calcularVencimentoLicenciamento(
  uf: string,
  placa: string,
  exercicio: number,
): string | null {
  const cal = CALENDARIO_LICENCIAMENTO[uf?.toUpperCase()];
  if (!cal) return null;
  const ultimoDigito = placa?.match(/\d/g)?.pop() ?? null;
  if (!ultimoDigito) return null;
  const mes = cal[ultimoDigito];
  if (!mes) return null;
  // new Date(ano, mes, 0) → último dia do mês informado (mes 1-12)
  let ano = exercicio;
  let dia = new Date(ano, mes, 0).getUTCDate();
  let iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const hoje = new Date().toISOString().slice(0, 10);
  if (iso < hoje) {
    ano = ano + 1;
    dia = new Date(ano, mes, 0).getUTCDate();
    iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  return iso;
}
