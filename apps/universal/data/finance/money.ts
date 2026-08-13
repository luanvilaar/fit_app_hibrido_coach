/**
 * Dinheiro em centavos inteiros, do banco até a borda da tela.
 *
 * O coach digita "300", "300,50" ou "R$ 1.250,00" e o que sai daqui é sempre um inteiro. Manter
 * o valor como `number` decimal em qualquer ponto do caminho reintroduziria o erro de ponto
 * flutuante que a coluna `integer` do banco existe para evitar.
 */

export class MoneyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyParseError";
  }
}

/** "R$ 300,00" — o formato que o coach lê na tela. */
export function formatBRL(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(Math.trunc(cents));
  const reais = Math.trunc(absolute / 100);
  const remainder = absolute % 100;

  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = String(remainder).padStart(2, "0");

  return `${negative ? "-" : ""}R$ ${grouped},${decimals}`;
}

/** "300,00" — sem o prefixo, para dentro de campos de entrada já rotulados com "R$". */
export function formatAmountInput(cents: number): string {
  return formatBRL(cents).replace("R$ ", "");
}

/**
 * Lê o que o coach digitou. Aceita as formas que aparecem na prática — com e sem prefixo, com
 * vírgula ou ponto decimal, com separador de milhar — e recusa o resto em vez de adivinhar:
 * um valor de cobrança interpretado errado só aparece no extrato do aluno.
 */
export function parseBRL(input: string): number {
  const trimmed = input.trim().replace(/^R\$\s*/i, "").trim();

  if (trimmed.length === 0) {
    throw new MoneyParseError("Informe o valor.");
  }

  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(trimmed)) {
    throw new MoneyParseError("Valor inválido. Use o formato 300,00.");
  }

  // "1.250,00" → milhar com ponto e decimal com vírgula; "300.50" → decimal com ponto.
  const hasComma = trimmed.includes(",");
  const normalized = hasComma ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;

  const value = Number(normalized);

  if (!Number.isFinite(value)) {
    throw new MoneyParseError("Valor inválido. Use o formato 300,00.");
  }

  // O arredondamento fecha o único ponto onde o float encosta no valor: "300.50" * 100 dá
  // 30049.999... em ponto flutuante binário.
  const cents = Math.round(value * 100);

  if (cents <= 0) {
    throw new MoneyParseError("O valor precisa ser maior que zero.");
  }

  return cents;
}
