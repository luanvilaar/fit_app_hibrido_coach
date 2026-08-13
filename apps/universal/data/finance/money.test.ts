import { MoneyParseError, formatAmountInput, formatBRL, parseBRL } from "@/data/finance/money";

describe("formatação de dinheiro", () => {
  it("mostra centavos sempre com duas casas", () => {
    expect(formatBRL(30000)).toBe("R$ 300,00");
    expect(formatBRL(30050)).toBe("R$ 300,50");
    expect(formatBRL(30005)).toBe("R$ 300,05");
  });

  it("separa milhar com ponto, como o coach escreve", () => {
    expect(formatBRL(125000)).toBe("R$ 1.250,00");
    expect(formatBRL(100000000)).toBe("R$ 1.000.000,00");
  });

  it("mostra zero em vez de campo vazio", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });

  it("marca valor negativo com o sinal antes do prefixo", () => {
    expect(formatBRL(-2500)).toBe("-R$ 25,00");
  });

  it("entrega o valor sem prefixo para campos já rotulados com R$", () => {
    expect(formatAmountInput(30000)).toBe("300,00");
  });
});

describe("leitura do valor digitado", () => {
  it("aceita o número puro como reais inteiros", () => {
    expect(parseBRL("300")).toBe(30000);
  });

  it("aceita vírgula decimal", () => {
    expect(parseBRL("300,50")).toBe(30050);
  });

  it("aceita ponto decimal, que é o que o teclado numérico oferece", () => {
    expect(parseBRL("300.50")).toBe(30050);
  });

  it("aceita separador de milhar junto com decimal", () => {
    expect(parseBRL("1.250,00")).toBe(125000);
  });

  it("aceita o prefixo colado ou separado", () => {
    expect(parseBRL("R$ 300,00")).toBe(30000);
    expect(parseBRL("R$300")).toBe(30000);
  });

  it("ignora espaço em volta", () => {
    expect(parseBRL("  300,00  ")).toBe(30000);
  });

  it("arredonda o centavo em vez de truncar o erro do float", () => {
    // 300.50 * 100 dá 30049.999… em ponto flutuante binário.
    expect(parseBRL("300,50")).toBe(30050);
    expect(parseBRL("0,07")).toBe(7);
    expect(parseBRL("1,10")).toBe(110);
  });

  it("recusa valor vazio", () => {
    expect(() => parseBRL("   ")).toThrow(MoneyParseError);
    expect(() => parseBRL("")).toThrow(/informe o valor/i);
  });

  it("recusa zero e negativo, que não são cobrança", () => {
    expect(() => parseBRL("0")).toThrow(/maior que zero/i);
    expect(() => parseBRL("0,00")).toThrow(/maior que zero/i);
    expect(() => parseBRL("-50")).toThrow(/inválido/i);
  });

  it("recusa texto em vez de adivinhar um número", () => {
    expect(() => parseBRL("trezentos")).toThrow(/inválido/i);
    expect(() => parseBRL("300 reais")).toThrow(/inválido/i);
    expect(() => parseBRL("30,,00")).toThrow(/inválido/i);
  });

  it("recusa mais de duas casas decimais, que não existem em centavo", () => {
    expect(() => parseBRL("300,005")).toThrow(/inválido/i);
  });
});
