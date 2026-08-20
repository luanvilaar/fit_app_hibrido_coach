module.exports = {
  preset: "jest-expo",
  // `api/` fica fora do app mas é código de pagamento: precisa dos mesmos testes e do mesmo gate.
  // Sem esta raiz extra, os testes ao lado das funções simplesmente não seriam coletados.
  roots: ["<rootDir>", "<rootDir>/../../api"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.cjs"],
  testMatch: ["**/*.(test|spec).(ts|tsx)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@fitblock/design-tokens$": "<rootDir>/../../packages/design-tokens/src/index.ts",
    // api/ roda como ESM real na Vercel (NodeNext exige extensão .js mesmo importando um .ts) —
    // aqui removemos a extensão antes de resolver, para o Jest achar o .ts normalmente.
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
};
