module.exports = {
  preset: "jest-expo",
  // `api/` fica fora do app mas é código de pagamento: precisa dos mesmos testes e do mesmo gate.
  // Sem esta raiz extra, os testes ao lado das funções simplesmente não seriam coletados.
  roots: ["<rootDir>", "<rootDir>/../../api"],
  testMatch: ["**/*.(test|spec).(ts|tsx)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@fitblock/design-tokens$": "<rootDir>/../../packages/design-tokens/src/index.ts"
  }
};
