import * as XLSX from "xlsx";

export function exportarXLSX(dados: any[], nomeAba: string, nomeArquivo: string) {
  if (!dados.length) return;
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nomeAba.slice(0, 31));
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${nomeArquivo}_${stamp}.xlsx`);
}
